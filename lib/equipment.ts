/**
 * Catálogo de equipamientos físicos de un ejercicio. Los slugs internos
 * coinciden con los del dataset open-source que poblamos (`exercises.json`)
 * para que el backfill sea trivial. Los labels son los que se muestran en
 * los selectores del admin y los chips del cliente.
 */

export type EquipmentId =
  | "body_weight"
  | "dumbbell"
  | "barbell"
  | "ez_barbell"
  | "cable"
  | "machine"
  | "smith_machine"
  | "kettlebell"
  | "band"
  | "resistance_band"
  | "medicine_ball"
  | "stability_ball"
  | "bosu_ball"
  | "rope"
  | "roller"
  | "sled"
  | "rings"
  | "weighted"
  | "assisted"
  | "other";

export type EquipmentDef = { id: EquipmentId; label: string };

export const EQUIPMENTS: readonly EquipmentDef[] = [
  { id: "body_weight", label: "Peso corporal" },
  { id: "dumbbell", label: "Mancuernas" },
  { id: "barbell", label: "Barra" },
  { id: "ez_barbell", label: "Barra EZ" },
  { id: "cable", label: "Polea / Cable" },
  { id: "machine", label: "Máquina" },
  { id: "smith_machine", label: "Smith" },
  { id: "kettlebell", label: "Pesa rusa" },
  { id: "band", label: "Banda elástica" },
  { id: "resistance_band", label: "Banda resistiva" },
  { id: "medicine_ball", label: "Balón medicinal" },
  { id: "stability_ball", label: "Fitball" },
  { id: "bosu_ball", label: "Bosu" },
  { id: "rope", label: "Cuerda" },
  { id: "roller", label: "Rodillo" },
  { id: "sled", label: "Trineo" },
  { id: "rings", label: "Anillas" },
  { id: "weighted", label: "Con peso adicional" },
  { id: "assisted", label: "Asistido" },
  { id: "other", label: "Otro" },
];

const VALID_IDS = new Set<string>(EQUIPMENTS.map((e) => e.id));

/**
 * Mapeo desde los valores que vienen del dataset original (en inglés con
 * espacios) al slug interno. Cualquier valor desconocido cae a "other".
 */
const DATASET_TO_SLUG: Record<string, EquipmentId> = {
  "body weight": "body_weight",
  "bodyweight": "body_weight",
  "dumbbell": "dumbbell",
  "barbell": "barbell",
  "olympic barbell": "barbell",
  "ez barbell": "ez_barbell",
  "cable": "cable",
  "leverage machine": "machine",
  "machine": "machine",
  "smith machine": "smith_machine",
  "kettlebell": "kettlebell",
  "band": "band",
  "resistance band": "resistance_band",
  "medicine ball": "medicine_ball",
  "stability ball": "stability_ball",
  "bosu ball": "bosu_ball",
  "rope": "rope",
  "roller": "roller",
  "wheel roller": "roller",
  "sled machine": "sled",
  "rings": "rings",
  "weighted": "weighted",
  "assisted": "assisted",
};

export function normalizeEquipment(raw: string | null | undefined): EquipmentId | null {
  if (!raw) return null;
  const t = raw.toLowerCase().trim();
  if (VALID_IDS.has(t)) return t as EquipmentId;
  const mapped = DATASET_TO_SLUG[t];
  if (mapped) return mapped;
  return "other";
}

export function equipmentLabel(id: EquipmentId | string | null | undefined): string {
  if (!id) return "—";
  const found = EQUIPMENTS.find((e) => e.id === id);
  return found ? found.label : "Otro";
}
