import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import {
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_BYTES,
  publicUrlForUpload,
  routineUploadsDirAbs,
  sanitizeFolderSegment,
  sanitizeUploadFilename,
} from "@/lib/routine-uploads";

export const runtime = "nodejs";

const MAX_FILES_PER_REQUEST = 80;

type Skipped = { name: string; reason: string };
type Written = { name: string; url: string };

/**
 * Sube los archivos de UNA subcarpeta a
 * `public/images/routines/uploads/<folder>/<archivo>`. El cliente debe llamar
 * a este endpoint una vez por subcarpeta del árbol seleccionado en el
 * navegador (webkitdirectory).
 *
 * Body: multipart/form-data
 *   - `folder` (text): nombre de la subcarpeta (se sanea contra a-z0-9_-).
 *   - `files`  (multi): archivos a subir.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Formulario inválido (multipart esperado)" },
      { status: 400 },
    );
  }

  const rawFolder = formData.get("folder");
  if (typeof rawFolder !== "string" || rawFolder.trim() === "") {
    return NextResponse.json(
      { error: "Falta el nombre de la subcarpeta (folder)" },
      { status: 400 },
    );
  }
  const folder = sanitizeFolderSegment(rawFolder);
  if (!folder) {
    return NextResponse.json(
      {
        error:
          "Nombre de subcarpeta no válido. Usa solo letras, números, guion o guion bajo.",
      },
      { status: 400 },
    );
  }

  const filesRaw = formData.getAll("files");
  const files: File[] = filesRaw.filter(
    (x): x is File => x instanceof File && x.size > 0,
  );

  if (files.length === 0) {
    return NextResponse.json(
      { error: "No se recibió ningún archivo." },
      { status: 400 },
    );
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      {
        error: `Máximo ${MAX_FILES_PER_REQUEST} archivos por subida. Divide la carpeta en lotes más pequeños.`,
      },
      { status: 400 },
    );
  }

  const destDir = path.join(routineUploadsDirAbs(), folder);
  // Defensa contra path traversal: aunque `sanitizeFolderSegment` no permite
  // `..`, recomprobamos que el destino esté dentro del árbol uploads.
  const root = routineUploadsDirAbs();
  if (!destDir.startsWith(root + path.sep) && destDir !== root) {
    return NextResponse.json(
      { error: "Ruta destino inválida" },
      { status: 400 },
    );
  }

  const written: Written[] = [];
  const skipped: Skipped[] = [];

  try {
    await mkdir(destDir, { recursive: true });
  } catch (e) {
    console.error("[uploads] mkdir", e);
    return NextResponse.json(
      { error: "No se pudo crear la subcarpeta destino." },
      { status: 500 },
    );
  }

  for (const f of files) {
    const originalName = f.name || "archivo";

    if (f.size > MAX_UPLOAD_BYTES) {
      skipped.push({
        name: originalName,
        reason: `supera ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
      });
      continue;
    }
    const mime = f.type || "application/octet-stream";
    if (!ALLOWED_UPLOAD_MIME.has(mime)) {
      skipped.push({
        name: originalName,
        reason: `tipo no permitido (${mime})`,
      });
      continue;
    }
    const filename = sanitizeUploadFilename(originalName);
    if (!filename) {
      skipped.push({
        name: originalName,
        reason: "nombre o extensión inválida",
      });
      continue;
    }

    let buf: Buffer;
    try {
      buf = Buffer.from(await f.arrayBuffer());
    } catch {
      skipped.push({ name: originalName, reason: "no se pudo leer" });
      continue;
    }
    if (buf.length < 10) {
      skipped.push({ name: originalName, reason: "archivo vacío" });
      continue;
    }

    const dest = path.join(destDir, filename);
    if (!dest.startsWith(destDir + path.sep)) {
      // Defensa extra: aunque sanitizeUploadFilename no permite `/`, verificamos.
      skipped.push({ name: originalName, reason: "ruta no segura" });
      continue;
    }

    try {
      await writeFile(dest, buf);
      written.push({ name: filename, url: publicUrlForUpload(folder, filename) });
    } catch (e) {
      console.error("[uploads] writeFile", e);
      skipped.push({ name: originalName, reason: "error al escribir en disco" });
    }
  }

  return NextResponse.json({
    folder,
    written,
    skipped,
    message:
      skipped.length === 0
        ? `Subidos ${written.length} archivo(s) a "${folder}".`
        : `Subidos ${written.length} archivo(s); ${skipped.length} omitido(s).`,
  });
}
