import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { MAX_ROUTINE_GIF_BYTES } from "@/lib/routine-gif-upload";

export const runtime = "nodejs";

const START = 28;
const MAX_FILES = 7;
const END = 34;

const srcDir = () => path.join(process.cwd(), "gym", "nuevos");
const destDir = () => path.join(process.cwd(), "public", "images", "routines", "gallery");

/**
 * Copia los .gif de `gym/nuevos` (raíz del repo) a
 * `public/images/routines/gallery/routine-gallery-28.gif` … 34, en orden alfabético.
 */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  let names: string[];
  try {
    names = await readdir(srcDir());
  } catch {
    return NextResponse.json(
      {
        error:
          "No existe la carpeta gym/nuevos en la raíz del proyecto. Créala y coloca ahí los .gif (máx. 7).",
      },
      { status: 400 },
    );
  }

  const gifs = names
    .filter((n) => n.toLowerCase().endsWith(".gif"))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  if (gifs.length === 0) {
    return NextResponse.json(
      {
        error:
          "En gym/nuevos no hay archivos .gif. Copia las imágenes a esa carpeta (raíz del repo → gym → nuevos) y vuelve a intentar.",
      },
      { status: 400 },
    );
  }

  const toCopy = gifs.slice(0, MAX_FILES);
  const skipped = gifs.length > MAX_FILES ? gifs.length - MAX_FILES : 0;

  const written: string[] = [];
  const fromNames: string[] = [];

  try {
    await mkdir(destDir(), { recursive: true });
    for (let i = 0; i < toCopy.length; i++) {
      const slot = START + i;
      if (slot > END) break;
      const name = toCopy[i]!;
      const absSrc = path.join(srcDir(), name);
      const buf = await readFile(absSrc);
      if (buf.length > MAX_ROUTINE_GIF_BYTES) {
        return NextResponse.json(
          { error: `El archivo «${name}» supera 12 MB` },
          { status: 400 },
        );
      }
      if (buf.length < 10) {
        return NextResponse.json(
          { error: `El archivo «${name}» está vacío o no es válido` },
          { status: 400 },
        );
      }
      const out = `routine-gallery-${slot}.gif`;
      await writeFile(path.join(destDir(), out), buf);
      written.push(out);
      fromNames.push(name);
    }
  } catch (e) {
    console.error("[api/admin/gallery-install-from-workspace]", e);
    return NextResponse.json(
      { error: "No se pudo leer o escribir archivos. Comprueba permisos en gym/nuevos y public/." },
      { status: 500 },
    );
  }

  let message = `Instalados ${written.length} GIF en la galería (28–34), orden A–Z por nombre.`;
  if (skipped > 0) {
    message += ` Se omitieron ${skipped} archivo(s) extra (máx. 7).`;
  }

  return NextResponse.json({
    ok: true,
    written,
    fromNames,
    message,
  });
}
