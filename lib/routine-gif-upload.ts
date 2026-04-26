import { mkdir } from "fs/promises";
import path from "path";

export const ROUTINE_GIF_SUBDIR = "images/routines" as const;

export function routineGifDirAbs(): string {
  return path.join(process.cwd(), "public", ROUTINE_GIF_SUBDIR);
}

export async function ensureRoutineGifDir(): Promise<void> {
  await mkdir(routineGifDirAbs(), { recursive: true });
}

export const MAX_ROUTINE_GIF_BYTES = 12 * 1024 * 1024;

export function isGifMime(mime: string): boolean {
  return mime === "image/gif";
}

export function gifExtension(): string {
  return ".gif";
}
