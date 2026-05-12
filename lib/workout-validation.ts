/**
 * Validación compartida para crear/editar Workouts y sus WorkoutItems.
 *
 * - Cliente y server usan estas funciones para que los mensajes de error sean
 *   coherentes (ej. "reps" admite "12", "12-15", "30 seg", máx 24 caracteres).
 * - No tocan Prisma; devuelven payloads ya saneados o un error string.
 */

import { isRoutineCategoryId, normalizeRoutineCategory } from "./routine-categories";

export const MAX_WORKOUT_NAME_LEN = 60;
export const MAX_WORKOUT_DESC_LEN = 600;
export const MAX_WORKOUT_ITEMS = 30;
export const MIN_SETS = 1;
export const MAX_SETS = 20;
export const MAX_REPS_LEN = 24;
export const MAX_NOTES_LEN = 200;
export const MIN_REST_SEC = 0;
export const MAX_REST_SEC = 600;

export type WorkoutItemInput = {
  exerciseId: string;
  sets: number;
  reps: string;
  restSec: number | null;
  notes: string | null;
};

export type WorkoutInput = {
  name: string;
  description: string;
  category: string;
  items: WorkoutItemInput[];
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function sanitizeText(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, maxLen);
}

function sanitizeReps(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw.trim().replace(/\s+/g, " ").slice(0, MAX_REPS_LEN);
  return cleaned;
}

export function validateWorkoutPayload(
  body: unknown,
): ValidationResult<WorkoutInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "JSON inválido" };
  }
  const b = body as Record<string, unknown>;

  const name = sanitizeText(b.name, MAX_WORKOUT_NAME_LEN);
  if (!name) return { ok: false, error: "Nombre de la rutina requerido" };

  const description = sanitizeText(b.description ?? "", MAX_WORKOUT_DESC_LEN);

  const categoryRaw =
    typeof b.category === "string" ? b.category.trim().toLowerCase() : "";
  if (categoryRaw && !isRoutineCategoryId(categoryRaw)) {
    return { ok: false, error: "Categoría no válida" };
  }
  const category = normalizeRoutineCategory(categoryRaw || undefined);

  if (!Array.isArray(b.items) || b.items.length === 0) {
    return { ok: false, error: "Añade al menos un ejercicio a la rutina" };
  }
  if (b.items.length > MAX_WORKOUT_ITEMS) {
    return {
      ok: false,
      error: `Máximo ${MAX_WORKOUT_ITEMS} ejercicios por rutina`,
    };
  }

  const items: WorkoutItemInput[] = [];
  for (let i = 0; i < b.items.length; i += 1) {
    const it = b.items[i];
    if (typeof it !== "object" || it === null) {
      return { ok: false, error: `Ejercicio ${i + 1}: formato inválido` };
    }
    const r = it as Record<string, unknown>;

    const exerciseId =
      typeof r.exerciseId === "string" ? r.exerciseId.trim() : "";
    if (!exerciseId) {
      return {
        ok: false,
        error: `Ejercicio ${i + 1}: selecciona un ejercicio de la biblioteca`,
      };
    }

    const setsRaw =
      typeof r.sets === "number"
        ? r.sets
        : typeof r.sets === "string"
          ? Number(r.sets)
          : NaN;
    if (!Number.isInteger(setsRaw) || setsRaw < MIN_SETS || setsRaw > MAX_SETS) {
      return {
        ok: false,
        error: `Ejercicio ${i + 1}: series debe ser un entero entre ${MIN_SETS} y ${MAX_SETS}`,
      };
    }

    const reps = sanitizeReps(r.reps);
    if (!reps) {
      return {
        ok: false,
        error: `Ejercicio ${i + 1}: indica las repeticiones (ej. "12", "12-15", "30 seg")`,
      };
    }

    let restSec: number | null = null;
    if (r.restSec !== undefined && r.restSec !== null && r.restSec !== "") {
      const n =
        typeof r.restSec === "number"
          ? r.restSec
          : typeof r.restSec === "string"
            ? Number(r.restSec)
            : NaN;
      if (!Number.isInteger(n) || n < MIN_REST_SEC || n > MAX_REST_SEC) {
        return {
          ok: false,
          error: `Ejercicio ${i + 1}: descanso debe estar entre ${MIN_REST_SEC} y ${MAX_REST_SEC} segundos`,
        };
      }
      restSec = n;
    }

    const notesTrim = sanitizeText(r.notes ?? "", MAX_NOTES_LEN);
    const notes = notesTrim.length > 0 ? notesTrim : null;

    items.push({ exerciseId, sets: setsRaw, reps, restSec, notes });
  }

  return {
    ok: true,
    value: { name, description, category, items },
  };
}
