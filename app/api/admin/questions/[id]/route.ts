import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { NO_OPTION_TEXT, YES_OPTION_TEXT } from "@/lib/yes-no";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  let body: {
    text?: string;
    sortOrder?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const existing = await prisma.question.findUnique({
    where: { id },
    include: { options: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  if (body.text !== undefined && !body.text.trim()) {
    return NextResponse.json({ error: "Texto vacío" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const answered = await tx.answer.count({ where: { questionId: id } });
    if (answered === 0) {
      await tx.questionOption.deleteMany({ where: { questionId: id } });
      await tx.questionOption.createMany({
        data: [
          { questionId: id, text: YES_OPTION_TEXT, sortOrder: 0 },
          { questionId: id, text: NO_OPTION_TEXT, sortOrder: 1 },
        ],
      });
    }

    await tx.question.update({
      where: { id },
      data: {
        ...(body.text !== undefined ? { text: body.text.trim() } : {}),
        ...(typeof body.sortOrder === "number" ? { sortOrder: body.sortOrder } : {}),
      },
    });
  });

  const question = await prisma.question.findUnique({
    where: { id },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ question });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const exists = await prisma.question.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.answer.deleteMany({ where: { questionId: id } });
    await tx.question.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
