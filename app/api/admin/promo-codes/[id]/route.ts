import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import { isDiscountType } from "@/lib/promo";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  let body: {
    description?: string;
    discountType?: string;
    discountValue?: number;
    minSubtotalCents?: number | null;
    maxUses?: number | null;
    maxUsesPerUser?: number | null;
    validFrom?: string | null;
    validUntil?: string | null;
    active?: boolean;
    isPublic?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.description === "string") {
    data.description = body.description.trim().slice(0, 200);
  }
  if (body.discountType !== undefined) {
    if (!isDiscountType(body.discountType)) {
      return NextResponse.json({ error: "Tipo de descuento no válido" }, { status: 400 });
    }
    data.discountType = body.discountType;
  }
  if (body.discountValue !== undefined) {
    const v = Math.floor(Number(body.discountValue));
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: "Valor de descuento no válido" }, { status: 400 });
    }
    data.discountValue = v;
  }
  if (body.minSubtotalCents !== undefined) {
    data.minSubtotalCents =
      body.minSubtotalCents == null || body.minSubtotalCents === 0
        ? null
        : Math.max(0, Math.floor(body.minSubtotalCents));
  }
  if (body.maxUses !== undefined) {
    data.maxUses =
      body.maxUses == null || body.maxUses === 0
        ? null
        : Math.max(1, Math.floor(body.maxUses));
  }
  if (body.maxUsesPerUser !== undefined) {
    data.maxUsesPerUser =
      body.maxUsesPerUser == null
        ? null
        : body.maxUsesPerUser === 0
        ? null
        : Math.max(1, Math.floor(body.maxUsesPerUser));
  }
  function parseDate(input?: string | null): Date | null {
    if (!input) return null;
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (body.validFrom !== undefined) data.validFrom = parseDate(body.validFrom);
  if (body.validUntil !== undefined) data.validUntil = parseDate(body.validUntil);
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.isPublic === "boolean") data.isPublic = body.isPublic;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  try {
    const updated = await prisma.promoCode.update({
      where: { id },
      data,
    });
    return NextResponse.json({ code: updated });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/admin/promo-codes PATCH]", e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    // Si ya tiene canjes, mejor lo desactivamos en vez de borrar para mantener
    // historial. El admin puede forzar borrado más adelante si lo necesita.
    const promo = await prisma.promoCode.findUnique({
      where: { id },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!promo) {
      return NextResponse.json({ error: "No existe" }, { status: 404 });
    }
    if (promo._count.redemptions > 0) {
      const deactivated = await prisma.promoCode.update({
        where: { id },
        data: { active: false },
      });
      return NextResponse.json({
        deactivated: true,
        code: deactivated,
        message: "Tiene canjes previos: se desactivó en vez de borrar.",
      });
    }
    await prisma.promoCode.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/admin/promo-codes DELETE]", e);
  }
}
