/**
 * Ilustraciones copiadas desde la galería local (`Descargas/gym` → `public/images/routines/gallery/`).
 * Cada entrada es una fila independiente en el admin al crear/editar rutinas.
 */
export const ROUTINE_GALLERY_ASSETS = [
  { id: "gallery-01", label: "GIF base", path: "/images/routines/gallery/routine-gallery-01.gif" },
  { id: "gallery-02", label: "_ (1)", path: "/images/routines/gallery/routine-gallery-02.gif" },
  { id: "gallery-03", label: "_ (2)", path: "/images/routines/gallery/routine-gallery-03.gif" },
  { id: "gallery-04", label: "_ (3) JPEG", path: "/images/routines/gallery/routine-gallery-04.jpeg" },
  { id: "gallery-05", label: "_ (3) GIF", path: "/images/routines/gallery/routine-gallery-05.gif" },
  { id: "gallery-06", label: "_ (4) GIF", path: "/images/routines/gallery/routine-gallery-06.gif" },
  { id: "gallery-07", label: "_ (4) JPEG", path: "/images/routines/gallery/routine-gallery-07.jpeg" },
  { id: "gallery-08", label: "_ (5)", path: "/images/routines/gallery/routine-gallery-08.gif" },
  { id: "gallery-09", label: "_ (6)", path: "/images/routines/gallery/routine-gallery-09.gif" },
  { id: "gallery-10", label: "_ (7)", path: "/images/routines/gallery/routine-gallery-10.gif" },
  { id: "gallery-11", label: "_ (8)", path: "/images/routines/gallery/routine-gallery-11.gif" },
  { id: "gallery-12", label: "_ (9)", path: "/images/routines/gallery/routine-gallery-12.gif" },
  { id: "gallery-13", label: "_ (10)", path: "/images/routines/gallery/routine-gallery-13.gif" },
  { id: "gallery-14", label: "_ (11)", path: "/images/routines/gallery/routine-gallery-14.gif" },
  { id: "gallery-15", label: "_ (12)", path: "/images/routines/gallery/routine-gallery-15.gif" },
  { id: "gallery-16", label: "_ (13)", path: "/images/routines/gallery/routine-gallery-16.gif" },
  { id: "gallery-17", label: "_ (14)", path: "/images/routines/gallery/routine-gallery-17.gif" },
  {
    id: "gallery-18",
    label: "Cable crossover tríceps",
    path: "/images/routines/gallery/routine-gallery-18.gif",
  },
  {
    id: "gallery-19",
    label: "Dumbbell lying rear lateral raise",
    path: "/images/routines/gallery/routine-gallery-19.gif",
  },
  {
    id: "gallery-20",
    label: "Dumbbell seated shoulder press (JPEG)",
    path: "/images/routines/gallery/routine-gallery-20.jpeg",
  },
  { id: "gallery-21", label: "GIF (archivo por hash)", path: "/images/routines/gallery/routine-gallery-21.gif" },
  {
    id: "gallery-22",
    label: "Standing cable crunch (FitnessProgramer)",
    path: "/images/routines/gallery/routine-gallery-22.gif",
  },
  {
    id: "gallery-23",
    label: "Leg extension (MensPower)",
    path: "/images/routines/gallery/routine-gallery-23.gif",
  },
  {
    id: "gallery-24",
    label: "Lying chest press machine — tutorial",
    path: "/images/routines/gallery/routine-gallery-24.gif",
  },
] as const;

export type RoutineGalleryAssetId = (typeof ROUTINE_GALLERY_ASSETS)[number]["id"];

export function galleryLabelForPath(path: string): string | null {
  const t = path.trim();
  const g = ROUTINE_GALLERY_ASSETS.find((x) => x.path === t);
  return g?.label ?? null;
}
