import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import { shouldDegradeWorkoutQuery } from "@/lib/prisma-workout-health";

/**
 * Listado público de rutinas-sesión (Workouts) con sus ejercicios y sets/reps.
 * Sin autenticación: lo consume `/rutina/categoria/<slug>` y `/rutina/todas`.
 *
 * Se devuelve con nombres en español para mantener la API del cliente que
 * el resto de componentes (`RutinaListScreen`, `RutinaCategoryPicker`) usan.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = {
  headers: {
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  },
};

export async function GET() {
  try {
    const rows = await prisma.workout.findMany({
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
    const rutinas = rows.map((w) => ({
      id: w.id,
      nombre: w.name,
      descripcion: w.description,
      categoria: w.category,
      items: w.items.map((it) => ({
        id: it.id,
        sets: it.sets,
        reps: it.reps,
        rest_sec: it.restSec,
        notes: it.notes,
        ejercicio: {
          id: it.exercise.id,
          nombre: it.exercise.name,
          descripcion: it.exercise.description,
          gif_url: it.exercise.gifUrl,
          categoria: it.exercise.category,
        },
      })),
    }));
    return NextResponse.json({ rutinas }, noStore);
  } catch (e) {
    if (shouldDegradeWorkoutQuery(e)) {
      console.error("[api/workouts GET] degraded", e);
      return NextResponse.json({ rutinas: [] }, noStore);
    }
    return nextResponseFromPrismaCatch("[api/workouts GET]", e);
  }
}
