import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import {
  computeDiscountCents,
  hashUserKey,
  normalizeCode,
  redeemPromoInTx,
  validatePromoCode,
} from "@/lib/promo";
import { getClientIp, getDeviceKey } from "@/lib/survey-rate-limit";

export const runtime = "nodejs";

type LineIn = { productId?: string; quantity?: number };

export async function POST(req: Request) {
  let body: {
    studentName?: string | null;
    studentNote?: string | null;
    lines?: LineIn[];
    /** Código de promoción opcional (en mayúsculas o como el usuario lo escriba). */
    promoCode?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const merged = new Map<string, number>();

  for (const row of rawLines) {
    const id = typeof row.productId === "string" ? row.productId.trim() : "";
    const qty =
      typeof row.quantity === "number" && Number.isInteger(row.quantity)
        ? row.quantity
        : 0;
    if (!id || qty <= 0) continue;
    merged.set(id, (merged.get(id) ?? 0) + qty);
  }

  if (merged.size === 0) {
    return NextResponse.json(
      { error: "Añade al menos un producto con cantidad mayor que 0" },
      { status: 400 },
    );
  }

  const productIds = [...merged.keys()];
  const promoInput = typeof body.promoCode === "string" ? normalizeCode(body.promoCode) : "";

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "Algún producto no existe o no está disponible" },
        { status: 400 },
      );
    }

    const subtotalCents = products.reduce(
      (acc, p) => acc + p.priceCents * merged.get(p.id)!,
      0,
    );

    // Si vino un código, lo validamos AHORA con el subtotal real calculado en
    // servidor (no aceptamos discountCents que mande el cliente).
    const ip = getClientIp(req);
    const userKey = hashUserKey(getDeviceKey(req, ip));
    let promoValidation: Awaited<ReturnType<typeof validatePromoCode>> | null = null;
    if (promoInput) {
      promoValidation = await validatePromoCode(prisma, promoInput, subtotalCents, {
        userKey,
        kind: undefined, // aceptamos store y survey_reward indistintamente en tienda
      });
      if (!promoValidation.ok) {
        return NextResponse.json(
          {
            error: promoValidation.message,
            promoError: promoValidation.error,
          },
          { status: 400 },
        );
      }
    }

    const studentName =
      typeof body.studentName === "string" ? body.studentName.trim().slice(0, 120) : "";
    const studentNote =
      typeof body.studentNote === "string" ? body.studentNote.trim().slice(0, 500) : "";

    // Toda la creación (orden + líneas + canje atómico del código) en una
    // sola transacción para que ningún paso quede a medias.
    const result = await prisma.$transaction(async (tx) => {
      let promoRedemptionId: string | null = null;
      let discountCents = 0;
      let promoCodeText: string | null = null;

      if (promoValidation && promoValidation.ok) {
        const redemption = await redeemPromoInTx(tx, {
          promoId: promoValidation.code.id,
          subtotalCents,
          userKey,
        });
        promoRedemptionId = redemption.redemptionId;
        discountCents = redemption.amountSavedCents;
        promoCodeText = redemption.code;
      } else {
        // Sin código: el descuento "fixed/percent/free" se recalcula igual con
        // valor 0 para mantener la línea simétrica con la API.
        discountCents = computeDiscountCents(subtotalCents, {
          discountType: "fixed",
          discountValue: 0,
        });
      }

      const totalCents = Math.max(0, subtotalCents - discountCents);

      const order = await tx.salesOrder.create({
        data: {
          studentName: studentName || null,
          studentNote: studentNote || null,
          subtotalCents,
          discountCents,
          totalCents,
          promoCode: promoCodeText,
          promoRedemptionId,
          lines: {
            create: products.map((p) => ({
              productId: p.id,
              quantity: merged.get(p.id)!,
              priceCents: p.priceCents,
            })),
          },
        },
      });
      return { order, subtotalCents, discountCents, totalCents, promoCodeText };
    });

    return NextResponse.json({
      order: {
        id: result.order.id,
        submittedAt: result.order.submittedAt.toISOString(),
      },
      pricing: {
        subtotalCents: result.subtotalCents,
        discountCents: result.discountCents,
        totalCents: result.totalCents,
        promoCode: result.promoCodeText,
      },
    });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/public/sales-orders POST]", e);
  }
}
