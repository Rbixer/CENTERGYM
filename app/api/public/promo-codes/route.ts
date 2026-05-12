import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";

export const runtime = "nodejs";

/**
 * Catálogo público de códigos de promoción. Solo devuelve los que el admin
 * marcó como `isPublic = true`, están activos, dentro de fechas y no agotados.
 * Pensado para alimentar la página /promos y un badge "hay promos" en la home.
 *
 * No expone campos internos como `description` (puede contener notas para el
 * admin), `notes`, `submissionId`, etc.
 */
export async function GET() {
  try {
    const now = new Date();
    const rows = await prisma.promoCode.findMany({
      where: {
        isPublic: true,
        active: true,
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        code: true,
        kind: true,
        discountType: true,
        discountValue: true,
        minSubtotalCents: true,
        maxUses: true,
        uses: true,
        validUntil: true,
      },
    });

    // Filtramos agotados en memoria (en SQL sería más caro por el null check).
    const codes = rows
      .filter((r) => r.maxUses == null || r.uses < r.maxUses)
      .map((r) => ({
        code: r.code,
        kind: r.kind,
        discountType: r.discountType,
        discountValue: r.discountValue,
        minSubtotalCents: r.minSubtotalCents,
        usesLeft: r.maxUses != null ? Math.max(0, r.maxUses - r.uses) : null,
        validUntil: r.validUntil?.toISOString() ?? null,
      }));

    return NextResponse.json({ codes });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/public/promo-codes]", e);
  }
}
