import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const orders = await prisma.salesOrder.findMany({
      orderBy: { submittedAt: "desc" },
      include: {
        lines: {
          include: { product: true },
        },
      },
    });

    return NextResponse.json({ orders });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/admin/sales-orders GET]", e);
  }
}
