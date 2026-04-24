import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { yesNoNestedCreate } from "@/lib/yes-no";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const questions = await prisma.question.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json({ questions });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { text?: string; sortOrder?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Texto requerido" }, { status: 400 });
  }

  const maxOrder = await prisma.question.aggregate({ _max: { sortOrder: true } });
  const sortOrder =
    typeof body.sortOrder === "number"
      ? body.sortOrder
      : (maxOrder._max.sortOrder ?? -1) + 1;

  const q = await prisma.question.create({
    data: {
      text,
      sortOrder,
      options: yesNoNestedCreate(),
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ question: q });
}
