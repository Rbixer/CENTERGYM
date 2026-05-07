import { createHmac } from "crypto";

/**
 * Rate limiter en memoria para la encuesta pública.
 *
 * - Una sola instancia (SQLite + systemd `gymcenter.service`), así que un Map
 *   en proceso es suficiente. No se persiste a través de reinicios, pero los
 *   reinicios son raros y solo amplían un poco la ventana del atacante.
 * - Sliding window por (clave) con dos límites a la vez: corto plazo
 *   (anti‑spam inmediato) y largo plazo (anti‑inundación diaria).
 * - Limpieza perezosa: cada cierto número de inserciones se purga lo viejo.
 */

type Bucket = {
  /** timestamps en ms ordenados ascendentemente (los más viejos primero) */
  timestamps: number[];
};

// Los límites están pensados para que 1 IP pueda corresponder a una red Wi‑Fi
// del gym (varios alumnos detrás del mismo NAT) sin bloquear el caso real,
// pero sí frenar abuso obvio (un script que envía 100/min).
const SHORT_WINDOW_MS = 10 * 60 * 1000; // 10 min
const SHORT_LIMIT = 20; // 20 envíos / 10 min por IP
const LONG_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h
const LONG_LIMIT = 100; // 100 envíos / día por IP
const PURGE_EVERY = 200; // purgar mapa cada N hits

const buckets = new Map<string, Bucket>();
let hitsSinceLastPurge = 0;

function purgeIfNeeded(now: number) {
  hitsSinceLastPurge += 1;
  if (hitsSinceLastPurge < PURGE_EVERY) return;
  hitsSinceLastPurge = 0;
  for (const [key, b] of buckets) {
    const cutoff = now - LONG_WINDOW_MS;
    while (b.timestamps.length && b.timestamps[0]! < cutoff) {
      b.timestamps.shift();
    }
    if (b.timestamps.length === 0) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; retryAfterSec: number; reason: "short" | "long" };

/**
 * Comprueba si la `key` puede enviar una nueva encuesta. Si devuelve `allowed`,
 * registra el hit; si no, no se registra (no penalizamos al que ya está bloqueado).
 */
export function checkSurveyRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  purgeIfNeeded(now);

  const bucket = buckets.get(key) ?? { timestamps: [] };
  const shortCutoff = now - SHORT_WINDOW_MS;
  const longCutoff = now - LONG_WINDOW_MS;

  // limpieza local (más barata que recorrer todo el Map)
  while (bucket.timestamps.length && bucket.timestamps[0]! < longCutoff) {
    bucket.timestamps.shift();
  }

  const shortCount = bucket.timestamps.filter((t) => t >= shortCutoff).length;
  const longCount = bucket.timestamps.length;

  if (shortCount >= SHORT_LIMIT) {
    const oldestInWindow = bucket.timestamps.find((t) => t >= shortCutoff)!;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldestInWindow + SHORT_WINDOW_MS - now) / 1000),
    );
    return { allowed: false, retryAfterSec, reason: "short" };
  }
  if (longCount >= LONG_LIMIT) {
    const oldestInWindow = bucket.timestamps[0]!;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldestInWindow + LONG_WINDOW_MS - now) / 1000),
    );
    return { allowed: false, retryAfterSec, reason: "long" };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  return {
    allowed: true,
    remaining: SHORT_LIMIT - (shortCount + 1),
    resetAt: now + SHORT_WINDOW_MS,
  };
}

/**
 * Devuelve la IP del cliente, considerando el proxy reverso (Nginx en producción
 * setea `X-Forwarded-For`). Si no hay headers de proxy, usa el host de la URL
 * como último recurso.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

/**
 * Hash HMAC truncado de la IP para guardar en `Submission.ipHash`. Usa el mismo
 * `ADMIN_SECRET` que el resto de tokens, así no se necesita una variable nueva.
 * No se puede revertir a la IP original, pero permite contar duplicados.
 */
export function hashIpForStorage(ip: string): string | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < 16) return null;
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 24);
}
