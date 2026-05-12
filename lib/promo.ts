import { createHmac, randomBytes } from "crypto";
import type { Prisma, PrismaClient, PromoCode } from "@prisma/client";

/**
 * Tipos de promoción. `store` y `survey_reward` son los activos en esta
 * iteración; los demás están reservados para futuras fases (pase de día,
 * mensualidades, referidos).
 */
export const PROMO_KINDS = [
  "store",
  "survey_reward",
  "day_pass",
  "membership",
  "referral",
] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

export const DISCOUNT_TYPES = ["percent", "fixed", "free"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export function isPromoKind(v: unknown): v is PromoKind {
  return typeof v === "string" && (PROMO_KINDS as readonly string[]).includes(v);
}
export function isDiscountType(v: unknown): v is DiscountType {
  return typeof v === "string" && (DISCOUNT_TYPES as readonly string[]).includes(v);
}

/** Normaliza un código tal como lo escribe el usuario: trim + mayúsculas. */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * Validador estricto: 3..32 caracteres, solo letras A-Z, dígitos 0-9 y guion `-`.
 * Se aplica tanto al crear desde admin como al validar en cliente.
 */
export function isValidCodeFormat(code: string): boolean {
  return /^[A-Z0-9-]{3,32}$/.test(code);
}

/**
 * Genera un código auto, sin letras/dígitos confusos (0,O,1,I,L) en bloques
 * separados por guion para que sea fácil leerlo en voz alta. Ej. "GRACIAS-A7B2K".
 */
const SAFE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0,O,1,I,L

export function generateRandomCode(
  prefix?: string,
  blocks = 1,
  blockSize = 5,
): string {
  const buf = randomBytes(blocks * blockSize);
  const parts: string[] = [];
  if (prefix) parts.push(prefix.toUpperCase());
  for (let b = 0; b < blocks; b++) {
    let s = "";
    for (let i = 0; i < blockSize; i++) {
      s += SAFE_ALPHABET[buf[b * blockSize + i]! % SAFE_ALPHABET.length];
    }
    parts.push(s);
  }
  return parts.join("-");
}

/**
 * Calcula el descuento en centavos para un subtotal dado. No verifica
 * disponibilidad (eso lo hace {@link validatePromoCode}); solo aplica la
 * regla `discountType`+`discountValue`. Garantiza:
 *   0 <= discount <= subtotal
 */
export function computeDiscountCents(
  subtotalCents: number,
  promo: Pick<PromoCode, "discountType" | "discountValue">,
): number {
  if (subtotalCents <= 0) return 0;
  if (promo.discountType === "free") return subtotalCents;
  if (promo.discountType === "fixed") {
    return Math.max(0, Math.min(subtotalCents, Math.floor(promo.discountValue)));
  }
  // percent
  const pct = Math.max(0, Math.min(100, Math.floor(promo.discountValue)));
  const raw = Math.floor((subtotalCents * pct) / 100);
  return Math.max(0, Math.min(subtotalCents, raw));
}

/**
 * Hash estable de "quién está canjeando" para contar usos por usuario sin
 * guardar PII. Usa `ADMIN_SECRET` como sal compartida con el resto de hashes.
 */
export function hashUserKey(rawKey: string): string | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < 16) return null;
  return createHmac("sha256", secret).update(rawKey).digest("hex").slice(0, 32);
}

export type PromoValidationError =
  | "code_required"
  | "code_format"
  | "not_found"
  | "inactive"
  | "not_yet_valid"
  | "expired"
  | "exhausted"
  | "min_subtotal"
  | "per_user_exhausted";

export const PROMO_ERROR_MESSAGES: Record<PromoValidationError, string> = {
  code_required: "Escribe un código.",
  code_format: "El código tiene un formato no válido.",
  not_found: "Ese código no existe.",
  inactive: "Ese código ya no está activo.",
  not_yet_valid: "Ese código todavía no está vigente.",
  expired: "El código ya caducó.",
  exhausted: "El código ya alcanzó su límite de usos.",
  min_subtotal: "Tu pedido aún no llega al mínimo para usar ese código.",
  per_user_exhausted: "Ya canjeaste este código anteriormente.",
};

export type ValidatePromoResult =
  | {
      ok: true;
      code: PromoCode;
      discountCents: number;
      totalCents: number;
    }
  | { ok: false; error: PromoValidationError; message: string };

/**
 * Validación stateless del código contra un subtotal. NO incrementa `uses`
 * ni crea `PromoRedemption`. Usa esto antes de mostrar el descuento en UI y
 * dentro de la transacción de canje para revalidar.
 */
export async function validatePromoCode(
  db: Pick<PrismaClient, "promoCode" | "promoRedemption">,
  rawCode: string,
  subtotalCents: number,
  opts?: { userKey?: string | null; kind?: PromoKind },
): Promise<ValidatePromoResult> {
  const code = normalizeCode(rawCode ?? "");
  if (!code) return fail("code_required");
  if (!isValidCodeFormat(code)) return fail("code_format");

  const promo = await db.promoCode.findUnique({ where: { code } });
  if (!promo) return fail("not_found");
  if (opts?.kind && promo.kind !== opts.kind) return fail("not_found");
  if (!promo.active) return fail("inactive");

  const now = new Date();
  if (promo.validFrom && promo.validFrom > now) return fail("not_yet_valid");
  if (promo.validUntil && promo.validUntil < now) return fail("expired");
  if (promo.maxUses != null && promo.uses >= promo.maxUses) {
    return fail("exhausted");
  }
  if (
    promo.minSubtotalCents != null &&
    subtotalCents < promo.minSubtotalCents
  ) {
    return fail("min_subtotal");
  }
  if (promo.maxUsesPerUser != null && opts?.userKey) {
    const count = await db.promoRedemption.count({
      where: { codeId: promo.id, userKey: opts.userKey },
    });
    if (count >= promo.maxUsesPerUser) return fail("per_user_exhausted");
  }

  const discountCents = computeDiscountCents(subtotalCents, promo);
  return {
    ok: true,
    code: promo,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents),
  };
}

function fail(error: PromoValidationError): ValidatePromoResult {
  return { ok: false, error, message: PROMO_ERROR_MESSAGES[error] };
}

/**
 * Canjea un código atómicamente dentro de una transacción Prisma. Devuelve
 * el id de la `PromoRedemption` creada o lanza si no se puede aplicar (lo
 * cual aborta la transacción del caller).
 *
 * Usa `updateMany` con la condición `uses < maxUses` para garantizar que dos
 * peticiones simultáneas no sobrepasen el límite (race condition real).
 */
export async function redeemPromoInTx(
  tx: Prisma.TransactionClient,
  args: {
    promoId: string;
    subtotalCents: number;
    userKey?: string | null;
  },
): Promise<{ redemptionId: string; amountSavedCents: number; code: string }> {
  const promo = await tx.promoCode.findUnique({ where: { id: args.promoId } });
  if (!promo) throw new Error("PROMO_NOT_FOUND");
  if (!promo.active) throw new Error("PROMO_INACTIVE");

  const now = new Date();
  if (promo.validFrom && promo.validFrom > now) throw new Error("PROMO_NOT_YET_VALID");
  if (promo.validUntil && promo.validUntil < now) throw new Error("PROMO_EXPIRED");
  if (promo.minSubtotalCents != null && args.subtotalCents < promo.minSubtotalCents) {
    throw new Error("PROMO_MIN_SUBTOTAL");
  }
  if (promo.maxUsesPerUser != null && args.userKey) {
    const count = await tx.promoRedemption.count({
      where: { codeId: promo.id, userKey: args.userKey },
    });
    if (count >= promo.maxUsesPerUser) throw new Error("PROMO_PER_USER_EXHAUSTED");
  }

  // Incremento atómico con condición. Si maxUses es null, solo subimos `uses`.
  const where: Prisma.PromoCodeWhereInput = { id: promo.id, active: true };
  if (promo.maxUses != null) {
    where.uses = { lt: promo.maxUses };
  }
  const updated = await tx.promoCode.updateMany({
    where,
    data: { uses: { increment: 1 } },
  });
  if (updated.count !== 1) throw new Error("PROMO_EXHAUSTED");

  const amountSavedCents = computeDiscountCents(args.subtotalCents, promo);
  const redemption = await tx.promoRedemption.create({
    data: {
      codeId: promo.id,
      userKey: args.userKey ?? null,
      amountSavedCents,
    },
  });
  return { redemptionId: redemption.id, amountSavedCents, code: promo.code };
}

/**
 * Garantiza que `submissionId` tenga un `PromoCode` asociado de tipo
 * `survey_reward`. Idempotente: si ya existe uno (por reintento o doble
 * submit), lo devuelve sin crear nada nuevo.
 */
export async function ensureSurveyRewardCode(
  db: Pick<PrismaClient, "promoCode">,
  args: {
    submissionId: string;
    discountType: DiscountType;
    discountValue: number;
    description?: string;
    validityDays?: number;
    minSubtotalCents?: number | null;
  },
): Promise<PromoCode> {
  const existing = await db.promoCode.findUnique({
    where: { submissionId: args.submissionId },
  });
  if (existing) return existing;

  // Reintentamos varias veces si por casualidad el código generado colisiona
  // (probabilidad ínfima con 5 caracteres del alfabeto seguro = ~28^5 = 17M).
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRandomCode("GRACIAS", 1, 5);
    try {
      return await db.promoCode.create({
        data: {
          code,
          description: args.description ?? "Recompensa por completar la encuesta",
          kind: "survey_reward",
          discountType: args.discountType,
          discountValue: args.discountValue,
          minSubtotalCents: args.minSubtotalCents ?? null,
          maxUses: 1,
          maxUsesPerUser: 1,
          validUntil: args.validityDays
            ? new Date(Date.now() + args.validityDays * 24 * 60 * 60 * 1000)
            : null,
          submissionId: args.submissionId,
          active: true,
        },
      });
    } catch (err) {
      lastErr = err;
      // P2002 = unique constraint failure → reintenta con otro código random
      continue;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Could not create reward code");
}

/**
 * Default de la recompensa por encuesta. Puede sobreescribirse luego desde el
 * admin si queremos campañas distintas. 10% durante 30 días sobre un mínimo
 * de Q50 (5000 centavos).
 */
export const DEFAULT_SURVEY_REWARD = {
  discountType: "percent" as const,
  discountValue: 10,
  validityDays: 30,
  minSubtotalCents: 5000,
};
