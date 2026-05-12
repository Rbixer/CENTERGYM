import {
  isPrismaClientStaleError,
  isPrismaSchemaMissingError,
} from "@/lib/prisma-api-error";

/** El delegate `workout` existe en el cliente Prisma generado. */
export function canUseWorkoutModel(client: unknown): boolean {
  const d = (client as { workout?: { findMany?: unknown } }).workout;
  return typeof d?.findMany === "function";
}

/** Tabla ausente o cliente sin modelo Workout. */
export function shouldDegradeWorkoutQuery(error: unknown): boolean {
  return isPrismaSchemaMissingError(error) || isPrismaClientStaleError(error);
}

export const WORKOUT_SETUP_ADMIN_HINT =
  "Activa las rutinas en el servidor: ejecuta «npx prisma generate» y «npm run db:push», y reinicia el servicio. Tras eso podrás crear rutinas con ejercicios.";

export const WORKOUT_SAVE_BLOCKED_MESSAGE =
  "Las rutinas (sesiones) no están activas en el servidor todavía. Aplica la migración (db:push) y reinicia.";
