import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";

export const runtime = "nodejs";

type LineIn = { productId?: string; quantity?: number };

export async function POST(req: Request) {
  let body: {
    studentName?: string | null;
    studentNote?: string | null;
    lines?: LineIn[];
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

    const studentName =
      typeof body.studentName === "string" ? body.studentName.trim().slice(0, 120) : "";
    const studentNote =
      typeof body.studentNote === "string" ? body.studentNote.trim().slice(0, 500) : "";

    const order = await prisma.salesOrder.create({
      data: {
        studentName: studentName || null,
        studentNote: studentNote || null,
        lines: {
          create: products.map((p) => ({
            productId: p.id,
            quantity: merged.get(p.id)!,
          })),
        },
      },
      include: {
        lines: { include: { product: true } },
      },
    });

    return NextResponse.json({
      order: {
        id: order.id,
        submittedAt: order.submittedAt.toISOString(),
      },
    });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/public/sales-orders POST]", e);
  }
}
