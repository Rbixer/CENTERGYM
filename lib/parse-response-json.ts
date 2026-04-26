/**
 * Lee el cuerpo de un fetch como JSON sin lanzar si viene vacío o no es JSON
 * (p. ej. 502 sin cuerpo, HTML de error, o corte de conexión).
 */
export async function parseResponseJson<T extends Record<string, unknown>>(
  res: Response,
): Promise<{
  ok: boolean;
  status: number;
  body: T | null;
  /** Mensaje cuando no hay JSON usable */
  parseError?: string;
}> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: res.ok,
      status: res.status,
      body: null,
      parseError: res.ok
        ? "El servidor respondió vacío."
        : `El servidor respondió vacío (HTTP ${res.status}). Si acabas de actualizar el código, ejecuta \`npx prisma db push\` y reinicia la app.`,
    };
  }
  try {
    const body = JSON.parse(trimmed) as T;
    return { ok: res.ok, status: res.status, body };
  } catch {
    return {
      ok: false,
      status: res.status,
      body: null,
      parseError:
        "La respuesta no es JSON (puede ser un error HTML del proxy o del servidor).",
    };
  }
}
