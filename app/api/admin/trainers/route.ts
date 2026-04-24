import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const trainers = await prisma.trainerGroup.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ trainers });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { label?: string; sortOrder?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const label = body.label?.trim();
  if (!label) {
    return NextResponse.json({ error: "Etiqueta requerida" }, { status: 400 });
  }

  const maxOrder = await prisma.trainerGroup.aggregate({
    _max: { sortOrder: true },
  });
  const sortOrder =
    typeof body.sortOrder === "number"
      ? body.sortOrder
      : (maxOrder._max.sortOrder ?? -1) + 1;

  const t = await prisma.trainerGroup.create({
    data: { label, sortOrder },
  });
  return NextResponse.json({ trainer: t });
}
