import { readdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

const EXT = /\.(gif|jpe?g|png|webp)$/i;

/**
 * Lista archivos en `public/images/routines/gallery` para comprobar qué
 * ilustraciones del listado realmente existen en el servidor.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const dir = path.join(process.cwd(), "public", "images", "routines", "gallery");
  try {
    const names = await readdir(dir);
    const files = names.filter((n) => EXT.test(n));
    return NextResponse.json({ files, dir: "/images/routines/gallery" });
  } catch {
    return NextResponse.json({ files: [] as string[], dir: "/images/routines/gallery" });
  }
}
