/** Ilustraciones incluidas en el proyecto; el admin elige por id (sin URL manual). */
export const ROUTINE_IMAGE_PRESETS = [
  {
    id: "cable-crossover-triceps",
    label: "Cable crossover tríceps",
    hint: "Extensión en polea — GIF de ejemplo",
    path: "/images/routines/gallery/routine-gallery-18.gif",
  },
  {
    id: "general",
    label: "General",
    hint: "Rutina mixta o variada",
    path: "/images/routines/preset-general.svg",
  },
  {
    id: "strength",
    label: "Fuerza",
    hint: "Pesas, hipertrofia, fuerza",
    path: "/images/routines/preset-strength.svg",
  },
  {
    id: "cardio",
    label: "Cardio",
    hint: "Resistencia, HIIT, aeróbico",
    path: "/images/routines/preset-cardio.svg",
  },
  {
    id: "mobility",
    label: "Movilidad",
    hint: "Estiramientos, yoga, recuperación",
    path: "/images/routines/preset-mobility.svg",
  },
] as const;

export type RoutineImagePresetId = (typeof ROUTINE_IMAGE_PRESETS)[number]["id"];

export function isRoutinePresetPath(path: string): boolean {
  const t = path.trim();
  return ROUTINE_IMAGE_PRESETS.some((p) => p.path === t);
}

export function isRoutinePresetId(id: string): id is RoutineImagePresetId {
  return ROUTINE_IMAGE_PRESETS.some((p) => p.id === id);
}

export function resolveRoutinePresetPath(id: string): string | null {
  const p = ROUTINE_IMAGE_PRESETS.find((x) => x.id === id.trim());
  return p?.path ?? null;
}

export function presetLabelForPath(path: string): string | null {
  const p = ROUTINE_IMAGE_PRESETS.find((x) => x.path === path.trim());
  return p?.label ?? null;
}
