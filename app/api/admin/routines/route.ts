import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import {
  canUseRoutineModel,
  ROUTINE_SAVE_BLOCKED_MESSAGE,
  ROUTINE_SETUP_ADMIN_HINT,
  shouldDegradeRoutineQuery,
} from "@/lib/prisma-routine-health";
import {
  generateAndSaveRoutineImageFromOpenAI,
  isOpenAiImageGenerationConfigured,
} from "@/lib/openai-routine-image";
import { isValidRoutineGifUrl } from "@/lib/routine-gif-url";
import { isRoutineCategoryId, normalizeRoutineCategory } from "@/lib/routine-categories";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const routines = await prisma.routine.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ routines });
  } catch (e) {
    if (shouldDegradeRoutineQuery(e)) {
      console.error("[api/admin/routines GET] degraded", e);
      return NextResponse.json({
        routines: [],
        setupRequired: true,
        setupHint: ROUTINE_SETUP_ADMIN_HINT,
      });
    }
    console.error("[api/admin/routines GET] listado degradado (cualquier fallo Prisma/SQLite)", e);
    return NextResponse.json({
      routines: [],
      setupRequired: true,
      setupHint: ROUTINE_SETUP_ADMIN_HINT,
    });
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!canUseRoutineModel(prisma)) {
    return NextResponse.json({ error: ROUTINE_SAVE_BLOCKED_MESSAGE }, { status: 422 });
  }

  let body: {
    name?: string;
    description?: string;
    gifUrl?: string;
    generateImage?: boolean;
    /** Slug de `lib/routine-categories` */
    category?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }
  const description = body.description?.trim() ?? "";
  if (!description) {
    return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
  }

  const categoryRaw = body.category?.trim().toLowerCase() ?? "";
  if (categoryRaw && !isRoutineCategoryId(categoryRaw)) {
    return NextResponse.json({ error: "Categoría no válida" }, { status: 400 });
  }
  const category = normalizeRoutineCategory(categoryRaw || undefined);

  let gifUrl = body.gifUrl?.trim() ?? "";

  if (body.generateImage) {
    if (!isOpenAiImageGenerationConfigured()) {
      return NextResponse.json(
        {
          error:
            "Generación con IA no disponible: configura OPENAI_API_KEY en el servidor (.env).",
        },
        { status: 422 },
      );
    }
    try {
      gifUrl = await generateAndSaveRoutineImageFromOpenAI(name, description);
    } catch (e) {
      console.error("[api/admin/routines POST] generateImage", e);
      const msg = e instanceof Error ? e.message : "Error al generar imagen";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  } else {
    const manual = gifUrl;
    if (isValidRoutineGifUrl(manual)) {
      gifUrl = manual;
    } else {
      return NextResponse.json(
        {
          error:
            "Indica una URL o ruta de imagen válida (p. ej. /images/routines/… o https://…), sube un GIF, o usa la generación con IA.",
        },
        { status: 400 },
      );
    }
  }

  try {
    const maxOrder = await prisma.routine.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    const routine = await prisma.routine.create({
      data: { name, description, gifUrl, category, sortOrder },
    });
    return NextResponse.json({ routine });
  } catch (e) {
    if (shouldDegradeRoutineQuery(e)) {
      console.error("[api/admin/routines POST] degraded", e);
      return NextResponse.json({ error: ROUTINE_SAVE_BLOCKED_MESSAGE }, { status: 422 });
    }
    return nextResponseFromPrismaCatch("[api/admin/routines POST]", e);
  }
}
