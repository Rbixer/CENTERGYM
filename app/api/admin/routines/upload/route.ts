import { randomBytes } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import {
  ensureRoutineGifDir,
  extensionForRoutineMedia,
  isAllowedRoutineMediaMime,
  MAX_ROUTINE_GIF_BYTES,
  ROUTINE_GIF_SUBDIR,
} from "@/lib/routine-gif-upload";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  if (file.size > MAX_ROUTINE_GIF_BYTES) {
    return NextResponse.json(
      { error: "El archivo no puede superar 12 MB" },
      { status: 400 },
    );
  }

  const mime = file.type || "application/octet-stream";
  if (!isAllowedRoutineMediaMime(mime)) {
    return NextResponse.json(
      { error: "Solo se permiten GIF, JPEG, PNG o WebP" },
      { status: 400 },
    );
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length < 10) {
      return NextResponse.json({ error: "Archivo vacío o corrupto" }, { status: 400 });
    }

    const ext = extensionForRoutineMedia(mime);
    if (!ext) {
      return NextResponse.json({ error: "Tipo de archivo no soportado" }, { status: 400 });
    }

    const name = `${randomBytes(12).toString("hex")}${ext}`;
    await ensureRoutineGifDir();
    const abs = path.join(process.cwd(), "public", ROUTINE_GIF_SUBDIR, name);
    await writeFile(abs, buf);

    const gifUrl = `/${ROUTINE_GIF_SUBDIR}/${name}`;
    return NextResponse.json({ gifUrl });
  } catch (e) {
    console.error("[api/admin/routines/upload]", e);
    return NextResponse.json(
      { error: "No se pudo guardar el archivo en public/images/routines." },
      { status: 500 },
    );
  }
}
