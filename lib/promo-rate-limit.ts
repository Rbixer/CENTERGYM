/**
 * Rate limit en memoria para la validación pública de códigos de promoción.
 *
 * Razón: el endpoint /api/promo/validate revela si un código existe o no.
 * Sin tope, un atacante puede tirar miles de combinaciones para descubrir
 * códigos válidos (especialmente los autogenerados de 5 chars).
 *
 * Estrategia: 30 intentos / 10 min y 200 / 24 h por IP. Suficiente para uso
 * legítimo (rellenar mal el código un par de veces, copy-paste con espacios,
 * etc.) y corta cualquier brute force razonable.
 */

type Bucket = { timestamps: number[] };

const SHORT_WINDOW_MS = 10 * 60 * 1000;
const SHORT_LIMIT = 30;
const LONG_WINDOW_MS = 24 * 60 * 60 * 1000;
const LONG_LIMIT = 200;
const PURGE_EVERY = 200;

const buckets = new Map<string, Bucket>();
let hits = 0;

function purgeIfNeeded(now: number) {
  hits += 1;
  if (hits < PURGE_EVERY) return;
  hits = 0;
  const cutoff = now - LONG_WINDOW_MS;
  for (const [key, b] of buckets) {
    while (b.timestamps.length && b.timestamps[0]! < cutoff) {
      b.timestamps.shift();
    }
    if (b.timestamps.length === 0) buckets.delete(key);
  }
}

export type PromoRateResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number };

export function checkPromoRateLimit(key: string): PromoRateResult {
  const now = Date.now();
  purgeIfNeeded(now);

  const bucket = buckets.get(key) ?? { timestamps: [] };
  const shortCutoff = now - SHORT_WINDOW_MS;
  const longCutoff = now - LONG_WINDOW_MS;
  while (bucket.timestamps.length && bucket.timestamps[0]! < longCutoff) {
    bucket.timestamps.shift();
  }
  const shortCount = bucket.timestamps.filter((t) => t >= shortCutoff).length;

  if (shortCount >= SHORT_LIMIT) {
    const oldest = bucket.timestamps.find((t) => t >= shortCutoff)!;
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((oldest + SHORT_WINDOW_MS - now) / 1000)),
    };
  }
  if (bucket.timestamps.length >= LONG_LIMIT) {
    const oldest = bucket.timestamps[0]!;
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((oldest + LONG_WINDOW_MS - now) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: SHORT_LIMIT - (shortCount + 1) };
}
