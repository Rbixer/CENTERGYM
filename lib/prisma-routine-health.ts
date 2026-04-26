import {
  isPrismaClientStaleError,
  isPrismaSchemaMissingError,
} from "@/lib/prisma-api-error";

/** El delegate `routine` existe en el cliente Prisma generado. */
export function canUseRoutineModel(client: unknown): boolean {
  const d = (client as { routine?: { findMany?: unknown } }).routine;
  return typeof d?.findMany === "function";
}

/** Tabla ausente o cliente sin modelo Routine (tras cambiar schema sin `generate` / `db push`). */
export function shouldDegradeRoutineQuery(error: unknown): boolean {
  return isPrismaSchemaMissingError(error) || isPrismaClientStaleError(error);
}

export const ROUTINE_SETUP_ADMIN_HINT =
  "Activa la base de datos de rutinas: en la carpeta del proyecto ejecuta «npx prisma generate», «npm run db:push» y reinicia (Ctrl+C y «npm run dev»). El script «dev» usa Webpack para que Prisma cargue bien; si usabas «npm run dev:turbo» y falla, prueba «npm run dev».";

export const ROUTINE_SAVE_BLOCKED_MESSAGE =
  "Las rutinas no están activas en el servidor todavía. Sigue el aviso informativo arriba, reinicia y vuelve a intentar.";
