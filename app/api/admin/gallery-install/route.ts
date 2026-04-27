import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { isGifMime, MAX_ROUTINE_GIF_BYTES } from "@/lib/routine-gif-upload";

export const runtime = "nodejs";

const START = 28;
const END = 34;

const galleryDirAbs = () =>
  path.join(process.cwd(), "public", "images", "routines", "gallery");

/**
 * Sube 1 a 7 GIF a la galería del sistema, en orden, como
 * routine-gallery-28.gif … routine-gallery-34.gif (además de las 27 base en admin).
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }

  const filesRaw = formData.getAll("files");
  const files: File[] = filesRaw.filter((x): x is File => x instanceof File && x.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos un GIF" }, { status: 400 });
  }
  if (files.length > 7) {
    return NextResponse.json(
      { error: "Como máximo 7 archivos a la vez (se asignan a 28…34 en orden alfabético por nombre)" },
      { status: 400 },
    );
  }

  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  for (const f of files) {
    if (f.size > MAX_ROUTINE_GIF_BYTES) {
      return NextResponse.json(
        { error: "Cada GIF no puede superar 12 MB" },
        { status: 400 },
      );
    }
    const mime = f.type || "application/octet-stream";
    if (!isGifMime(mime)) {
      return NextResponse.json(
        { error: "Solo se permiten archivos .gif" },
        { status: 400 },
      );
    }
  }

  const written: string[] = [];
  try {
    await mkdir(galleryDirAbs(), { recursive: true });
    for (let i = 0; i < files.length; i++) {
      const slot = START + i;
      if (slot > END) break;
      const buf = Buffer.from(await files[i]!.arrayBuffer());
      if (buf.length < 10) {
        return NextResponse.json(
          { error: `El archivo en la posición ${i + 1} está vacío o es inválido` },
          { status: 400 },
        );
      }
      const name = `routine-gallery-${slot}.gif`;
      const abs = path.join(galleryDirAbs(), name);
      await writeFile(abs, buf);
      written.push(name);
    }
  } catch (e) {
    console.error("[api/admin/gallery-install]", e);
    return NextResponse.json(
      { error: "No se pudo guardar en public/images/routines/gallery" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, written, message: "Galería actualizada en el servidor" });
}
