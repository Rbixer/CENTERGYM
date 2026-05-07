import { mkdir, readdir, stat } from "fs/promises";
import path from "path";
import {
  isRoutineCategoryId,
  type RoutineCategoryId,
  DEFAULT_ROUTINE_CATEGORY,
} from "./routine-categories";

/**
 * Subida de carpetas con subcarpetas a /admin/rutinas (drag&drop).
 *
 * - Estructura en disco: `public/images/routines/uploads/<carpeta>/<archivo>`.
 * - Las subcarpetas se sirven directamente como recursos estáticos en
 *   `/images/routines/uploads/<carpeta>/<archivo>` (no requieren entrada en
 *   `lib/routine-gallery-assets.ts`, que queda para la galería numerada base).
 * - Si el nombre de la carpeta coincide con un slug de `routine-categories.ts`
 *   (`biceps`, `piernas`, etc.), al seleccionar un GIF en el panel admin se
 *   autoasigna esa categoría a la rutina. Si no coincide, queda como
 *   `general` y la subcarpeta sirve como simple agrupador visual.
 */

export const ROUTINE_UPLOADS_SUBDIR = "images/routines/uploads" as const;

export const ALLOWED_UPLOAD_MIME = new Map<string, string>([
  ["image/gif", ".gif"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB por archivo
export const MAX_FOLDER_SEGMENT_LEN = 40;
export const MAX_FILENAME_LEN = 80;

const VALID_EXT_FROM_NAME = /\.(gif|jpe?g|png|webp)$/i;

export function routineUploadsDirAbs(): string {
  return path.join(process.cwd(), "public", ROUTINE_UPLOADS_SUBDIR);
}

export async function ensureRoutineUploadsDir(): Promise<void> {
  await mkdir(routineUploadsDirAbs(), { recursive: true });
}

/**
 * Sanea un segmento de carpeta:
 * - Quita espacios y caracteres no seguros (deja a-z, 0-9, `-`, `_`).
 * - Pasa todo a minúsculas.
 * - Recorta a `MAX_FOLDER_SEGMENT_LEN`.
 * - Devuelve `null` si queda vacío o solo guiones (para rechazar el ítem).
 */
export function sanitizeFolderSegment(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  const cleaned = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tildes
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_FOLDER_SEGMENT_LEN);
}

/**
 * Sanea el basename de un archivo manteniendo la extensión válida.
 * - Solo permite caracteres `[a-zA-Z0-9._-]`.
 * - Devuelve `null` si la extensión no es de las permitidas.
 */
export function sanitizeUploadFilename(raw: string): string | null {
  const base = raw.split(/[/\\]/).pop()?.trim();
  if (!base) return null;
  const m = base.match(VALID_EXT_FROM_NAME);
  if (!m) return null;
  const ext = m[0].toLowerCase().replace(".jpeg", ".jpg");
  const stem = base
    .slice(0, base.length - m[0].length)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  if (!stem) return null;
  const candidate = `${stem}${ext}`;
  if (candidate.length > MAX_FILENAME_LEN) {
    return `${stem.slice(0, MAX_FILENAME_LEN - ext.length)}${ext}`;
  }
  return candidate;
}

/**
 * Si la carpeta tiene el mismo slug que una `RoutineCategoryId`, la usamos como
 * categoría sugerida; si no, devolvemos `general`.
 */
export function categoryForFolder(folder: string): RoutineCategoryId {
  if (isRoutineCategoryId(folder)) return folder;
  return DEFAULT_ROUTINE_CATEGORY;
}

export function publicUrlForUpload(folder: string, filename: string): string {
  return `/${ROUTINE_UPLOADS_SUBDIR}/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
}

export type UploadFolderEntry = {
  /** Slug de la carpeta tal como está en disco (saneado). */
  folder: string;
  /** Categoría sugerida (folder si es válida, si no `general`). */
  category: RoutineCategoryId;
  /** Si `category === folder` significa que hay match con `routine-categories`. */
  matchesCategory: boolean;
  files: { name: string; url: string }[];
};

/**
 * Recorre `public/images/routines/uploads/` y devuelve el árbol agrupado por
 * subcarpeta de primer nivel. Solo incluye archivos con extensión permitida.
 */
export async function listUploadTree(): Promise<UploadFolderEntry[]> {
  const root = routineUploadsDirAbs();
  let folders: string[];
  try {
    folders = await readdir(root);
  } catch {
    return [];
  }
  const entries: UploadFolderEntry[] = [];
  for (const folder of folders) {
    if (folder.startsWith(".")) continue;
    const full = path.join(root, folder);
    let s;
    try {
      s = await stat(full);
    } catch {
      continue;
    }
    if (!s.isDirectory()) continue;
    let files: string[];
    try {
      files = await readdir(full);
    } catch {
      continue;
    }
    const valid = files
      .filter((n) => VALID_EXT_FROM_NAME.test(n))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    if (valid.length === 0) continue;
    entries.push({
      folder,
      category: categoryForFolder(folder),
      matchesCategory: isRoutineCategoryId(folder),
      files: valid.map((name) => ({
        name,
        url: publicUrlForUpload(folder, name),
      })),
    });
  }
  entries.sort((a, b) =>
    a.folder.localeCompare(b.folder, undefined, { sensitivity: "base" }),
  );
  return entries;
}
