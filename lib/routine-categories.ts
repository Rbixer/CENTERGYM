/**
 * Catálogo de tipos de rutina para alumnos (/rutina) y asignación en admin.
 * Slugs en ASCII; etiquetas en español.
 */
export const ROUTINE_CATEGORIES = [
  { id: "general", label: "General", hint: "Mixto o varias zonas" },
  { id: "brazos", label: "Brazos", hint: "Antebrazo y brazo completo" },
  { id: "biceps", label: "Bíceps", hint: "Flexión de codo" },
  { id: "triceps", label: "Tríceps", hint: "Extensión de codo" },
  { id: "pecho", label: "Pecho", hint: "Pectoral" },
  { id: "espalda", label: "Espalda", hint: "Dorsales y trapecio" },
  { id: "hombros", label: "Hombros", hint: "Deltoide" },
  { id: "piernas", label: "Piernas", hint: "Cuádriceps e isquios" },
  { id: "gluteos", label: "Glúteos", hint: "Cadena posterior" },
  { id: "core", label: "Core", hint: "Abdomen y estabilidad" },
  { id: "cardio", label: "Cardio", hint: "Resistencia" },
  { id: "movilidad", label: "Movilidad", hint: "Estiramientos" },
] as const;

export type RoutineCategoryId = (typeof ROUTINE_CATEGORIES)[number]["id"];

export const DEFAULT_ROUTINE_CATEGORY: RoutineCategoryId = "general";

export function isRoutineCategoryId(s: string): s is RoutineCategoryId {
  return ROUTINE_CATEGORIES.some((c) => c.id === s);
}

export function normalizeRoutineCategory(raw: string | undefined | null): RoutineCategoryId {
  const t = raw?.trim().toLowerCase() ?? "";
  if (isRoutineCategoryId(t)) return t;
  return DEFAULT_ROUTINE_CATEGORY;
}

export function routineCategoryLabel(id: string): string {
  const c = ROUTINE_CATEGORIES.find((x) => x.id === id);
  return c?.label ?? id;
}
