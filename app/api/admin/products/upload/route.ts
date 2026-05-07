import { randomBytes } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import {
  ensureProductUploadDir,
  extensionForMime,
  isAllowedProductImageMime,
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_UPLOAD_SUBDIR,
} from "@/lib/product-upload";

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

  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "La imagen no puede superar 5 MB" },
      { status: 400 },
    );
  }

  const mime = file.type || "application/octet-stream";
  if (!isAllowedProductImageMime(mime)) {
    return NextResponse.json(
      { error: "Solo se permiten JPEG, PNG, WebP o GIF" },
      { status: 400 },
    );
  }

  const ext = extensionForMime(mime);
  if (!ext) {
    return NextResponse.json({ error: "Tipo no soportado" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });
    }

    const name = `${randomBytes(16).toString("hex")}${ext}`;
    await ensureProductUploadDir();
    const abs = path.join(
      process.cwd(),
      "public",
      PRODUCT_UPLOAD_SUBDIR,
      name,
    );
    await writeFile(abs, buf);

    const imageUrl = `/${PRODUCT_UPLOAD_SUBDIR.replace(/^\/+/, "")}/${name}`;
    return NextResponse.json({ imageUrl });
  } catch (e) {
    console.error("[api/admin/products/upload]", e);
    return NextResponse.json(
      {
        error:
          "No se pudo guardar la imagen (permisos en disco o carpeta public/uploads).",
      },
      { status: 500 },
    );
  }
}
