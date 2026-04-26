import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextResponseFromPrismaCatch } from "@/lib/prisma-api-error";
import { shouldDegradeRoutineQuery } from "@/lib/prisma-routine-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = {
  headers: {
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  },
};

export async function GET() {
  try {
    const routines = await prisma.routine.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        gifUrl: true,
        category: true,
      },
    });
    return NextResponse.json({ routines }, noStore);
  } catch (e) {
    if (shouldDegradeRoutineQuery(e)) {
      console.error("[api/public/routines GET] degraded", e);
      return NextResponse.json({ routines: [] }, noStore);
    }
    return nextResponseFromPrismaCatch("[api/public/routines GET]", e);
  }
}
