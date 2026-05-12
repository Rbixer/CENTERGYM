import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import {
  generateRandomCode,
  isDiscountType,
  isPromoKind,
  isValidCodeFormat,
  normalizeCode,
} from "@/lib/promo";

export const runtime = "nodejs";

type ListedPromo = {
  id: string;
  code: string;
  description: string;
  kind: string;
  discountType: string;
  discountValue: number;
  minSubtotalCents: number | null;
  maxUses: number | null;
  uses: number;
  maxUsesPerUser: number | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  isPublic: boolean;
  createdAt: string;
  redemptionsCount: number;
  totalSavedCents: number;
};

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const rows = await prisma.promoCode.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { redemptions: true } },
        redemptions: { select: { amountSavedCents: true } },
      },
    });
    const codes: ListedPromo[] = rows.map((r) => ({
      id: r.id,
      code: r.code,
      description: r.description,
      kind: r.kind,
      discountType: r.discountType,
      discountValue: r.discountValue,
      minSubtotalCents: r.minSubtotalCents,
      maxUses: r.maxUses,
      uses: r.uses,
      maxUsesPerUser: r.maxUsesPerUser,
      validFrom: r.validFrom?.toISOString() ?? null,
      validUntil: r.validUntil?.toISOString() ?? null,
      active: r.active,
      isPublic: r.isPublic,
      createdAt: r.createdAt.toISOString(),
      redemptionsCount: r._count.redemptions,
      totalSavedCents: r.redemptions.reduce(
        (acc, x) => acc + x.amountSavedCents,
        0,
      ),
    }));
    return NextResponse.json({ codes });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/admin/promo-codes GET]", e);
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: {
    code?: string;
    description?: string;
    kind?: string;
    discountType?: string;
    discountValue?: number;
    minSubtotalCents?: number | null;
    maxUses?: number | null;
    maxUsesPerUser?: number | null;
    validFrom?: string | null;
    validUntil?: string | null;
    active?: boolean;
    isPublic?: boolean;
    autoGenerate?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const kind = body.kind ?? "store";
  if (!isPromoKind(kind)) {
    return NextResponse.json({ error: "Tipo no válido" }, { status: 400 });
  }
  // Bloqueamos los tipos no implementados todavía para no generar códigos
  // sin endpoint donde canjearlos.
  if (kind !== "store") {
    return NextResponse.json(
      {
        error:
          "Por ahora solo se pueden crear códigos de tipo `store` desde el admin. Los de tipo `survey_reward` se emiten automáticamente al enviar la encuesta.",
      },
      { status: 400 },
    );
  }

  const discountType = body.discountType ?? "percent";
  if (!isDiscountType(discountType)) {
    return NextResponse.json({ error: "Tipo de descuento no válido" }, { status: 400 });
  }
  const discountValue = Math.floor(Number(body.discountValue ?? 0));
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    return NextResponse.json({ error: "Valor de descuento no válido" }, { status: 400 });
  }
  if (discountType === "percent" && (discountValue < 1 || discountValue > 100)) {
    return NextResponse.json(
      { error: "El porcentaje debe estar entre 1 y 100" },
      { status: 400 },
    );
  }
  if (discountType === "fixed" && discountValue < 1) {
    return NextResponse.json(
      { error: "El descuento fijo debe ser mayor que 0 centavos" },
      { status: 400 },
    );
  }

  let code = body.autoGenerate
    ? generateRandomCode(undefined, 1, 5)
    : normalizeCode(body.code ?? "");
  if (!code) {
    return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  }
  if (!isValidCodeFormat(code)) {
    return NextResponse.json(
      { error: "El código solo admite letras, números y guiones (3-32)." },
      { status: 400 },
    );
  }
  // Si autogenerado, reintentamos en caso de colisión rarísima.
  if (body.autoGenerate) {
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.promoCode.findUnique({ where: { code } });
      if (!exists) break;
      code = generateRandomCode(undefined, 1, 5);
    }
  } else {
    const existing = await prisma.promoCode.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un código con ese nombre" },
        { status: 409 },
      );
    }
  }

  const description = (body.description ?? "").toString().trim().slice(0, 200);
  const maxUses =
    body.maxUses == null || body.maxUses === 0 ? null : Math.max(1, Math.floor(body.maxUses));
  const maxUsesPerUser =
    body.maxUsesPerUser == null
      ? 1
      : body.maxUsesPerUser === 0
      ? null
      : Math.max(1, Math.floor(body.maxUsesPerUser));
  const minSubtotalCents =
    body.minSubtotalCents == null || body.minSubtotalCents === 0
      ? null
      : Math.max(0, Math.floor(body.minSubtotalCents));

  function parseDate(input?: string | null): Date | null {
    if (!input) return null;
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  try {
    const created = await prisma.promoCode.create({
      data: {
        code,
        description,
        kind,
        discountType,
        discountValue,
        minSubtotalCents,
        maxUses,
        maxUsesPerUser,
        validFrom: parseDate(body.validFrom),
        validUntil: parseDate(body.validUntil),
        active: body.active !== false,
        isPublic: body.isPublic === true,
      },
    });
    return NextResponse.json({ code: created });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/admin/promo-codes POST]", e);
  }
}
