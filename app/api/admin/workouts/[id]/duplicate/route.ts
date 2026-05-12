import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import {
  canUseWorkoutModel,
  shouldDegradeWorkoutQuery,
  WORKOUT_SAVE_BLOCKED_MESSAGE,
} from "@/lib/prisma-workout-health";
import { MAX_WORKOUT_NAME_LEN } from "@/lib/workout-validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Duplica una rutina-sesión completa: copia header e items con sus sets/reps.
 * El nombre se sufija con " (copia)" respetando MAX_WORKOUT_NAME_LEN.
 */
export async function POST(_req: Request, ctx: Ctx) {
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
    const source = await prisma.workout.findUnique({
      where: { id },
      include: { items: { orderBy: [{ sortOrder: "asc" }] } },
    });
    if (!source) {
      return NextResponse.json(
        { error: "Rutina no encontrada" },
        { status: 404 },
      );
    }

    const suffix = " (copia)";
    const trimmed = source.name.slice(0, MAX_WORKOUT_NAME_LEN - suffix.length);
    const copyName = `${trimmed}${suffix}`;

    const maxOrder = await prisma.workout.aggregate({
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const created = await prisma.workout.create({
      data: {
        name: copyName,
        description: source.description,
        category: source.category,
        sortOrder,
        items: {
          create: source.items.map((it, i) => ({
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
    return nextResponseFromPrismaCatch("[api/admin/workouts/duplicate]", e);
  }
}
