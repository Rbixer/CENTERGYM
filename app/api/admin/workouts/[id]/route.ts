import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import {
  canUseWorkoutModel,
  shouldDegradeWorkoutQuery,
  WORKOUT_SAVE_BLOCKED_MESSAGE,
} from "@/lib/prisma-workout-health";
import { validateWorkoutPayload } from "@/lib/workout-validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    const workout = await prisma.workout.findUnique({
      where: { id },
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
                thumbUrl: true,
                category: true,
                equipment: true,
              },
            },
          },
        },
      },
    });
    if (!workout) {
      return NextResponse.json({ error: "Rutina no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ workout });
  } catch (e) {
    return nextResponseFromPrismaCatch("[api/admin/workouts GET id]", e);
  }
}

/**
 * Reemplaza la rutina entera: header (name/description/category) e items
 * completos. Más simple que diff parcial y al ser SQLite tiene poco coste.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!canUseWorkoutModel(prisma)) {
    return NextResponse.json(
      { error: WORKOUT_SAVE_BLOCKED_MESSAGE },
      { status: 422 },
    );
  }
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const v = validateWorkoutPayload(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  try {
    const current = await prisma.workout.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json(
        { error: "Rutina no encontrada" },
        { status: 404 },
      );
    }

    const ids = Array.from(new Set(v.value.items.map((i) => i.exerciseId)));
    const existing = await prisma.routine.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      return NextResponse.json(
        {
          error:
            "Alguno de los ejercicios seleccionados ya no existe en la biblioteca",
        },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.workoutItem.deleteMany({ where: { workoutId: id } });
      return tx.workout.update({
        where: { id },
        data: {
          name: v.value.name,
          description: v.value.description,
          category: v.value.category,
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
                  thumbUrl: true,
                  category: true,
                  equipment: true,
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json({ workout: updated });
  } catch (e) {
    if (shouldDegradeWorkoutQuery(e)) {
      return NextResponse.json(
        { error: WORKOUT_SAVE_BLOCKED_MESSAGE },
        { status: 422 },
      );
    }
    return nextResponseFromPrismaCatch("[api/admin/workouts PATCH]", e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!canUseWorkoutModel(prisma)) {
    return NextResponse.json(
      { error: WORKOUT_SAVE_BLOCKED_MESSAGE },
      { status: 422 },
    );
  }
  const { id } = await ctx.params;
  try {
    const row = await prisma.workout.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json(
        { error: "Rutina no encontrada" },
        { status: 404 },
      );
    }
    await prisma.workout.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (shouldDegradeWorkoutQuery(e)) {
      return NextResponse.json(
        { error: WORKOUT_SAVE_BLOCKED_MESSAGE },
        { status: 422 },
      );
    }
    return nextResponseFromPrismaCatch("[api/admin/workouts DELETE]", e);
  }
}
