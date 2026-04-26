import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import { shouldDegradeRoutineQuery } from "@/lib/prisma-routine-health";

/** Listado público de rutinas para alumnos (`/rutina`). Sin autenticación. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = {
  headers: {
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  },
};

export async function GET() {
  try {
    const rows = await prisma.routine.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        gifUrl: true,
        category: true,
      },
    });
    const rutinas = rows.map((r) => ({
      id: r.id,
      nombre: r.name,
      descripcion: r.description,
      gif_url: r.gifUrl,
      categoria: r.category,
    }));
    return NextResponse.json({ rutinas }, noStore);
  } catch (e) {
    if (shouldDegradeRoutineQuery(e)) {
      console.error("[api/rutinas GET] degraded", e);
      return NextResponse.json({ rutinas: [] }, noStore);
    }
    return nextResponseFromPrismaCatch("[api/rutinas GET]", e);
  }
}
