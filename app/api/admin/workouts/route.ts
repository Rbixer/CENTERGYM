import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import {
  canUseWorkoutModel,
  shouldDegradeWorkoutQuery,
  WORKOUT_SAVE_BLOCKED_MESSAGE,
  WORKOUT_SETUP_ADMIN_HINT,
} from "@/lib/prisma-workout-health";
import { validateWorkoutPayload } from "@/lib/workout-validation";

export const runtime = "nodejs";

/**
 * Listado de rutinas-sesión (Workouts) para el admin. Incluye cada ítem con
 * el ejercicio enlazado (nombre, gif, categoría) para que la UI no tenga
 * que hacer N+1 fetches.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const workouts = await prisma.workout.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }],
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
                description: true,
                gifUrl: true,
                category: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json({ workouts });
  } catch (e) {
    if (shouldDegradeWorkoutQuery(e)) {
      console.error("[api/admin/workouts GET] degraded", e);
      return NextResponse.json({
        workouts: [],
        setupRequired: true,
        setupHint: WORKOUT_SETUP_ADMIN_HINT,
      });
    }
    return nextResponseFromPrismaCatch("[api/admin/workouts GET]", e);
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!canUseWorkoutModel(prisma)) {
    return NextResponse.json(
      { error: WORKOUT_SAVE_BLOCKED_MESSAGE },
      { status: 422 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const v = validateWorkoutPayload(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  try {
    // Verifica que todos los exerciseId existen antes de crear.
    const ids = Array.from(new Set(v.value.items.map((i) => i.exerciseId)));
    const existing = await prisma.routine.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      return NextResponse.json(
        { error: "Alguno de los ejercicios seleccionados ya no existe en la biblioteca" },
        { status: 400 },
      );
    }

    const maxOrder = await prisma.workout.aggregate({
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const created = await prisma.workout.create({
      data: {
        name: v.value.name,
        description: v.value.description,
        category: v.value.category,
        sortOrder,
        items: {
          create: v.value.items.map((it, i) => ({
            exerciseId: it.exerciseId,
            sets: it.sets,
            reps: it.reps,
            restSec: it.restSec,
            notes: it.notes,
            sortOrder: i,
          })),
        },
      },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }],
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
                description: true,
                gifUrl: true,
                category: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ workout: created });
  } catch (e) {
    if (shouldDegradeWorkoutQuery(e)) {
      return NextResponse.json(
        { error: WORKOUT_SAVE_BLOCKED_MESSAGE },
        { status: 422 },
      );
    }
    return nextResponseFromPrismaCatch("[api/admin/workouts POST]", e);
  }
}
