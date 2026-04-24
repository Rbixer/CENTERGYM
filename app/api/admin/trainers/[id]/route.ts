import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  let body: { label?: string; sortOrder?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const label =
    body.label !== undefined ? body.label.trim() : undefined;
  if (label === "") {
    return NextResponse.json({ error: "Etiqueta vacía" }, { status: 400 });
  }

  try {
    const trainer = await prisma.trainerGroup.update({
      where: { id },
      data: {
        ...(label !== undefined ? { label } : {}),
        ...(typeof body.sortOrder === "number" ? { sortOrder: body.sortOrder } : {}),
      },
    });
    return NextResponse.json({ trainer });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const exists = await prisma.trainerGroup.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.submission.deleteMany({ where: { trainerGroupId: id } });
    await tx.trainerGroup.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
