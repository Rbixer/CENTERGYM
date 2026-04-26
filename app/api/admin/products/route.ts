import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const products = await prisma.product.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ products });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/admin/products GET]", e);
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { name?: string; priceCents?: number; imageUrl?: string; active?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }

  const priceCents = body.priceCents;
  if (typeof priceCents !== "number" || !Number.isInteger(priceCents) || priceCents < 0) {
    return NextResponse.json({ error: "Precio inválido (céntimos)" }, { status: 400 });
  }

  const imageUrl = body.imageUrl?.trim();
  if (!imageUrl || !imageUrl.startsWith("/uploads/products/")) {
    return NextResponse.json(
      { error: "Imagen requerida (sube una foto primero)" },
      { status: 400 },
    );
  }

  try {
    const maxOrder = await prisma.product.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const product = await prisma.product.create({
      data: {
        name,
        priceCents,
        imageUrl,
        sortOrder,
        active: body.active !== false,
      },
    });

    return NextResponse.json({ product });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/admin/products POST]", e);
  }
}
