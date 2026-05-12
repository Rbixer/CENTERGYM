import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import {
  hashUserKey,
  validatePromoCode,
  PROMO_ERROR_MESSAGES,
} from "@/lib/promo";
import { checkPromoRateLimit } from "@/lib/promo-rate-limit";
import { getClientIp, getDeviceKey } from "@/lib/survey-rate-limit";

export const runtime = "nodejs";

/**
 * Endpoint público para validar un código y previsualizar el descuento. No
 * canjea el código (el canje se hace dentro de la transacción de creación de
 * pedido o submit de encuesta). Solo lee, no escribe.
 *
 * Rate-limited por IP para impedir brute-force descubriendo códigos.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rate = checkPromoRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "Demasiados intentos. Espera unos minutos.",
        retryAfterSec: rate.retryAfterSec,
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  let body: { code?: string; subtotalCents?: number; kind?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const subtotalCents = Math.max(0, Math.floor(Number(body.subtotalCents ?? 0)));
  if (!Number.isFinite(subtotalCents)) {
    return NextResponse.json({ error: "Subtotal no válido" }, { status: 400 });
  }

  const userKey = hashUserKey(getDeviceKey(req, ip));

  try {
    const result = await validatePromoCode(prisma, body.code ?? "", subtotalCents, {
      userKey,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          message: result.message ?? PROMO_ERROR_MESSAGES[result.error],
        },
        { status: 200 },
      );
    }
    return NextResponse.json({
      ok: true,
      code: result.code.code,
      description: result.code.description,
      kind: result.code.kind,
      discountType: result.code.discountType,
      discountValue: result.code.discountValue,
      discountCents: result.discountCents,
      totalCents: result.totalCents,
    });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/promo/validate]", e);
  }
}
