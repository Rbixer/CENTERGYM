import { mkdir } from "fs/promises";
import path from "path";

export const PRODUCT_UPLOAD_SUBDIR = "uploads/products" as const;

export function productUploadDirAbs(): string {
  return path.join(process.cwd(), "public", PRODUCT_UPLOAD_SUBDIR);
}

export async function ensureProductUploadDir(): Promise<void> {
  await mkdir(productUploadDirAbs(), { recursive: true });
}

const ALLOWED = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

export function extensionForMime(mime: string): string | null {
  return ALLOWED.get(mime) ?? null;
}

export function isAllowedProductImageMime(mime: string): boolean {
  return ALLOWED.has(mime);
}
