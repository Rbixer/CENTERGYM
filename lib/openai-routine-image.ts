import { randomBytes } from "crypto";
import { unlink, writeFile } from "fs/promises";
import path from "path";
import { ensureRoutineGifDir, routineGifDirAbs } from "@/lib/routine-gif-upload";

const MAX_PROMPT_CHARS = 950;

/** Archivos generados por IA en disco (para poder borrarlos al regenerar). */
export function isAiGeneratedRoutinePath(gifUrl: string): boolean {
  const u = gifUrl.trim();
  return /^\/images\/routines\/[a-f0-9]{24}\.png$/i.test(u);
}

export function buildRoutineImagePrompt(name: string, description: string): string {
  const n = name
    .slice(0, 220)
    .replace(/[^\p{L}\p{N}\s\-.,áéíóúÁÉÍÓÚñÑüÜ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const rest = MAX_PROMPT_CHARS - n.length - 120;
  const d = description
    .slice(0, Math.max(40, rest))
    .replace(/\s+/g, " ")
    .trim();
  return [
    "High quality digital illustration for a gym workout routine card.",
    `Routine title: "${n}".`,
    `Description / focus: ${d}.`,
    "Show athletic training context: gym, exercise motion, or equipment. No text, letters, or watermarks in the image.",
    "Vibrant lighting, realistic proportions, cinematic composition.",
  ].join(" ");
}

export function isOpenAiImageGenerationConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Genera una ilustración con OpenAI Images (DALL·E 3), la descarga y la guarda en
 * `public/images/routines/*.png`. Devuelve la ruta pública `/images/routines/...`.
 */
export async function generateAndSaveRoutineImageFromOpenAI(
  name: string,
  description: string,
): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY no está configurada");
  }

  const prompt = buildRoutineImagePrompt(name, description);

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    }),
  });

  const raw = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`OpenAI respondió sin JSON (${res.status})`);
  }

  if (!res.ok) {
    const err = json as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `OpenAI error HTTP ${res.status}`);
  }

  const data = (json as { data?: { url?: string }[] }).data;
  const imageUrl = data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("OpenAI no devolvió URL de imagen");
  }

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error("No se pudo descargar la imagen generada");
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.length < 100) {
    throw new Error("Imagen descargada inválida");
  }

  await ensureRoutineGifDir();
  const filename = `${randomBytes(12).toString("hex")}.png`;
  const abs = path.join(routineGifDirAbs(), filename);
  await writeFile(abs, buf);

  return `/images/routines/${filename}`;
}

export async function deleteLocalRoutineFileIfSafe(gifUrl: string): Promise<void> {
  if (!isAiGeneratedRoutinePath(gifUrl)) return;
  const rel = gifUrl.trim().replace(/^\//, "");
  const abs = path.join(process.cwd(), "public", rel);
  try {
    await unlink(abs);
  } catch {
    /* ya borrada o no existe */
  }
}
