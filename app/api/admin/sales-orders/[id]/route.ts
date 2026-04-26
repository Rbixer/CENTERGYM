import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import {
  getPrismaErrorCode,
  isPrismaSchemaMissingError,
  nextResponseFromPrismaCatch,
} from "@/lib/prisma-api-error";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;

  let body: { verified?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof body.verified !== "boolean") {
    return NextResponse.json({ error: "verified boolean requerido" }, { status: 400 });
  }

  try {
    const order = await prisma.salesOrder.update({
      where: { id },
      data: {
        verified: body.verified,
        verifiedAt: body.verified ? new Date() : null,
      },
      include: {
        lines: { include: { product: true } },
      },
    });
    return NextResponse.json({ order });
  } catch (e) {
    if (isPrismaSchemaMissingError(e)) {
      return nextResponseFromPrismaCatch("[api/admin/sales-orders PATCH]", e);
    }
    if (getPrismaErrorCode(e) === "P2025") {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    return nextResponseFromPrismaCatch("[api/admin/sales-orders PATCH]", e);
  }
}
