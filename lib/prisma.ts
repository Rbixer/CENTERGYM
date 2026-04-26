import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const log =
  process.env.NODE_ENV === "development"
    ? (["error", "warn"] as const)
    : (["error"] as const);

function hasRoutineDelegate(client: unknown): boolean {
  return (
    typeof (client as { routine?: { findMany?: unknown } }).routine?.findMany === "function"
  );
}

/** Campos que el código asume en `Routine` (si el cliente en caché no los tiene, hay que recrearlo). */
const ROUTINE_RUNTIME_FIELDS_REQUIRED = ["category"] as const;

function routineRuntimeHasRequiredFields(client: unknown): boolean {
  const runtime = (client as { _runtimeDataModel?: { models?: { Routine?: { fields?: { name: string }[] } } } })
    ._runtimeDataModel;
  const names = new Set(runtime?.models?.Routine?.fields?.map((f) => f.name) ?? []);
  return ROUTINE_RUNTIME_FIELDS_REQUIRED.every((f) => names.has(f));
}

function createPrismaClient() {
  return new PrismaClient({ log: [...log] });
}

/**
 * Singleton con recuperación si quedó en caché un cliente generado **antes** de existir el modelo
 * Routine o antes de campos nuevos (p. ej. `category`): el delegate `routine` puede existir pero el
 * DMMF interno sigue siendo antiguo hasta recrear `PrismaClient`.
 *
 * `prisma` se expone vía Proxy para que cada acceso reevalúe la caché (evita quedar atados a una
 * instancia obsoleta si el módulo se recarga sin reiniciar el proceso por completo).
 */
function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && hasRoutineDelegate(cached) && routineRuntimeHasRequiredFields(cached)) {
    return cached;
  }
  if (cached) {
    void cached.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[prisma] Cliente en caché obsoleto (modelo Routine incompleto o sin campos esperados). Se crea uno nuevo; si sigue fallando, para el servidor (Ctrl+C), ejecuta npx prisma generate, npm run db:push y vuelve a npm run dev.",
      );
    }
  }

  const client = createPrismaClient();
  if (!hasRoutineDelegate(client)) {
    console.error(
      "[prisma] @prisma/client no incluye Routine. Para (Ctrl+C), ejecuta npx prisma generate y npm run dev.",
    );
    return client;
  }
  if (!routineRuntimeHasRequiredFields(client)) {
    console.error(
      "[prisma] El cliente generado no incluye los campos de Routine que usa la app (p. ej. category). Ejecuta npx prisma generate y reinicia el servidor.",
    );
    return client;
  }

  globalForPrisma.prisma = client;
  return client;
}

function createPrismaProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop, receiver) {
      const client = getPrisma();
      const value = Reflect.get(client as unknown as object, prop, receiver);
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(client);
      }
      return value;
    },
  });
}

export const prisma = createPrismaProxy();
