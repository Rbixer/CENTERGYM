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

  let body: {
    name?: string;
    priceCents?: number;
    imageUrl?: string;
    active?: boolean;
    sortOrder?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const data: {
    name?: string;
    priceCents?: number;
    imageUrl?: string;
    active?: boolean;
    sortOrder?: number;
  } = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Nombre vacío" }, { status: 400 });
    data.name = name;
  }

  if (body.priceCents !== undefined) {
    if (
      typeof body.priceCents !== "number" ||
      !Number.isInteger(body.priceCents) ||
      body.priceCents < 0
    ) {
      return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
    }
    data.priceCents = body.priceCents;
  }

  if (body.imageUrl !== undefined) {
    const u = body.imageUrl.trim();
    if (!u.startsWith("/uploads/products/")) {
      return NextResponse.json({ error: "URL de imagen inválida" }, { status: 400 });
    }
    data.imageUrl = u;
  }

  if (body.active !== undefined) {
    data.active = Boolean(body.active);
  }

  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== "number" || !Number.isInteger(body.sortOrder)) {
      return NextResponse.json({ error: "sortOrder inválido" }, { status: 400 });
    }
    data.sortOrder = body.sortOrder;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data,
    });
    return NextResponse.json({ product });
  } catch (e) {
    if (isPrismaSchemaMissingError(e)) {
      return nextResponseFromPrismaCatch("[api/admin/products PATCH]", e);
    }
    if (getPrismaErrorCode(e) === "P2025") {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    return nextResponseFromPrismaCatch("[api/admin/products PATCH]", e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.salesOrderLine.deleteMany({ where: { productId: id } });
      await tx.salesOrder.deleteMany({ where: { lines: { none: {} } } });
      await tx.product.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isPrismaSchemaMissingError(e)) {
      return nextResponseFromPrismaCatch("[api/admin/products DELETE]", e);
    }
    const code = getPrismaErrorCode(e);
    if (code === "P2025") {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    return nextResponseFromPrismaCatch("[api/admin/products DELETE]", e);
  }
}
