import { NextResponse } from "next/server";

/** Código Prisma sin `instanceof` (con Turbopack pueden existir dos copias del cliente). */
export function getPrismaErrorCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const c = (e as { code: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

export function getPrismaErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Tabla/columna ausente o base sin migrar. */
export function isPrismaSchemaMissingError(e: unknown): boolean {
  const code = getPrismaErrorCode(e);
  if (code === "P2021" || code === "P2022") return true;
  const m = getPrismaErrorMessage(e);
  return /no such table|does not exist in the current database|SQLITE_ERROR:\s*no such table/i.test(
    m,
  );
}

/**
 * Cliente `@prisma/client` generado antes de añadir un modelo al schema: el delegate
 * (p. ej. `prisma.routine`) no existe y falla con "reading 'findMany'" sobre `undefined`.
 */
export function isPrismaClientStaleError(e: unknown): boolean {
  const m = getPrismaErrorMessage(e);
  /** Cliente generado sin el delegate del modelo (Turbopack / proceso sin reiniciar tras `prisma generate`). */
  return /Cannot read properties of undefined \(reading '(findMany|findFirst|create|update|delete|upsert|count|aggregate)'\)/i.test(
    m,
  );
}

export function nextResponseFromPrismaCatch(
  logLabel: string,
  e: unknown,
): NextResponse {
  console.error(logLabel, e);
  if (isPrismaSchemaMissingError(e)) {
    return NextResponse.json(
      {
        error:
          "La base de datos no tiene las tablas necesarias. En la carpeta del proyecto ejecuta: npm run db:push — luego reinicia el servidor (npm run dev).",
        prismaCode: getPrismaErrorCode(e),
      },
      { status: 503 },
    );
  }
  if (isPrismaClientStaleError(e)) {
    return NextResponse.json(
      {
        error:
          "El cliente de Prisma está desactualizado (falta un modelo en el código generado). En la carpeta del proyecto ejecuta: npx prisma generate — luego npm run db:push si acabas de añadir tablas — y reinicia el servidor.",
        prismaCode: getPrismaErrorCode(e),
      },
      { status: 503 },
    );
  }
  const code = getPrismaErrorCode(e);
  const detail = getPrismaErrorMessage(e);
  const isDev = process.env.NODE_ENV === "development";
  return NextResponse.json(
    {
      error: isDev
        ? `Error de base de datos${code ? ` [${code}]` : ""}: ${detail}. Si acabas de actualizar el código, ejecuta npm run db:push y reinicia.`
        : `Error de base de datos${code ? ` (${code})` : ""}. Ejecuta npm run db:push en el servidor y revisa los logs.`,
      prismaCode: code,
    },
    { status: 500 },
  );
}
