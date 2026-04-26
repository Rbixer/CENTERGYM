import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import {
  canUseRoutineModel,
  ROUTINE_SAVE_BLOCKED_MESSAGE,
  shouldDegradeRoutineQuery,
} from "@/lib/prisma-routine-health";
import {
  deleteLocalRoutineFileIfSafe,
  generateAndSaveRoutineImageFromOpenAI,
  isOpenAiImageGenerationConfigured,
} from "@/lib/openai-routine-image";
import { isValidRoutineGifUrl } from "@/lib/routine-gif-url";
import { isRoutineCategoryId, normalizeRoutineCategory } from "@/lib/routine-categories";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!canUseRoutineModel(prisma)) {
    return NextResponse.json({ error: ROUTINE_SAVE_BLOCKED_MESSAGE }, { status: 422 });
  }

  const { id } = await ctx.params;

  let body: {
    name?: string;
    description?: string;
    gifUrl?: string;
    sortOrder?: number;
    regenerateImage?: boolean;
    category?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const current = await prisma.routine.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "Rutina no encontrada" }, { status: 404 });
  }

  const mergedName =
    body.name !== undefined ? body.name.trim() : current.name;
  const mergedDesc =
    body.description !== undefined ? body.description.trim() : current.description;

  if (body.name !== undefined && !mergedName) {
    return NextResponse.json({ error: "Nombre vacío" }, { status: 400 });
  }

  const data: {
    name?: string;
    description?: string;
    gifUrl?: string;
    sortOrder?: number;
    category?: string;
  } = {};

  if (body.name !== undefined) {
    data.name = mergedName;
  }
  if (body.description !== undefined) {
    data.description = mergedDesc;
  }
  if (body.gifUrl !== undefined) {
    const g = body.gifUrl.trim();
    if (!isValidRoutineGifUrl(g)) {
      return NextResponse.json({ error: "gif_url inválida" }, { status: 400 });
    }
    data.gifUrl = g;
  }
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder)) {
      return NextResponse.json({ error: "sortOrder inválido" }, { status: 400 });
    }
    data.sortOrder = body.sortOrder;
  }

  if (body.category !== undefined) {
    const c = body.category.trim().toLowerCase();
    if (!isRoutineCategoryId(c)) {
      return NextResponse.json({ error: "Categoría no válida" }, { status: 400 });
    }
    data.category = normalizeRoutineCategory(c);
  }

  if (body.regenerateImage) {
    if (!isOpenAiImageGenerationConfigured()) {
      return NextResponse.json(
        {
          error:
            "Generación con IA no disponible: configura OPENAI_API_KEY en el servidor.",
        },
        { status: 422 },
      );
    }
    try {
      const previousUrl = current.gifUrl;
      const newUrl = await generateAndSaveRoutineImageFromOpenAI(
        mergedName,
        mergedDesc,
      );
      await deleteLocalRoutineFileIfSafe(previousUrl);
      data.gifUrl = newUrl;
    } catch (e) {
      console.error("[api/admin/routines PATCH] regenerateImage", e);
      const msg = e instanceof Error ? e.message : "Error al generar imagen";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  try {
    const routine = await prisma.routine.update({ where: { id }, data });
    return NextResponse.json({ routine });
  } catch (e) {
    if (shouldDegradeRoutineQuery(e)) {
      console.error("[api/admin/routines PATCH] degraded", e);
      return NextResponse.json({ error: ROUTINE_SAVE_BLOCKED_MESSAGE }, { status: 422 });
    }
    return nextResponseFromPrismaCatch("[api/admin/routines PATCH]", e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!canUseRoutineModel(prisma)) {
    return NextResponse.json({ error: ROUTINE_SAVE_BLOCKED_MESSAGE }, { status: 422 });
  }

  const { id } = await ctx.params;

  try {
    const row = await prisma.routine.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json({ error: "Rutina no encontrada" }, { status: 404 });
    }
    await prisma.routine.delete({ where: { id } });
    await deleteLocalRoutineFileIfSafe(row.gifUrl);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (shouldDegradeRoutineQuery(e)) {
      console.error("[api/admin/routines DELETE] degraded", e);
      return NextResponse.json({ error: ROUTINE_SAVE_BLOCKED_MESSAGE }, { status: 422 });
    }
    return nextResponseFromPrismaCatch("[api/admin/routines DELETE]", e);
  }
}
