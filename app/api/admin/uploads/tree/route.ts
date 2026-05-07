import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { listUploadTree } from "@/lib/routine-uploads";

export const runtime = "nodejs";

/**
 * Devuelve el árbol de archivos en `public/images/routines/uploads/`,
 * agrupados por subcarpeta de primer nivel. Solo incluye archivos con
 * extensión permitida (.gif/.jpg/.png/.webp).
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const tree = await listUploadTree();
  return NextResponse.json({ tree });
}
