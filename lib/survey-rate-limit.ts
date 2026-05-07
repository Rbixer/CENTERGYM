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

// Límites por IP: equilibrio entre el caso real (Wi‑Fi del gym con varios
// alumnos detrás del mismo NAT, todos votando en el mismo día) y frenar
// inundaciones (script automático).
//   - corto:  5 envíos / 30 min por IP   (anti-spam inmediato)
//   - largo: 30 envíos / 24 h  por IP   (techo diario por red completa)
const IP_SHORT_WINDOW_MS = 30 * 60 * 1000; // 30 min
const IP_SHORT_LIMIT = 5;
const IP_LONG_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h
const IP_LONG_LIMIT = 30;

// Límite por dispositivo aproximado (IP + hash del User-Agent). Es la capa
// que hace cumplir "1 voto cada 15 días" cuando alguien borra cookies o
// abre incógnito en el mismo móvil/PC: el UA + IP cambia muy poco, así que
// lo capturamos.
//   - 2 envíos / 24 h por (IP+UA)
const DEVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEVICE_LIMIT = 2;

const PURGE_EVERY = 200; // purgar mapas cada N hits

type LimiterConfig = {
  shortWindowMs: number;
  shortLimit: number;
  longWindowMs: number;
  longLimit: number;
};

const IP_CONFIG: LimiterConfig = {
  shortWindowMs: IP_SHORT_WINDOW_MS,
  shortLimit: IP_SHORT_LIMIT,
  longWindowMs: IP_LONG_WINDOW_MS,
  longLimit: IP_LONG_LIMIT,
};

const DEVICE_CONFIG: LimiterConfig = {
  shortWindowMs: DEVICE_WINDOW_MS,
  shortLimit: DEVICE_LIMIT,
  longWindowMs: DEVICE_WINDOW_MS,
  longLimit: DEVICE_LIMIT,
};

const ipBuckets = new Map<string, Bucket>();
const deviceBuckets = new Map<string, Bucket>();
let hitsSinceLastPurge = 0;

function purgeIfNeeded(now: number) {
  hitsSinceLastPurge += 1;
  if (hitsSinceLastPurge < PURGE_EVERY) return;
  hitsSinceLastPurge = 0;
  for (const map of [ipBuckets, deviceBuckets]) {
    for (const [key, b] of map) {
      const cutoff = now - IP_LONG_WINDOW_MS;
      while (b.timestamps.length && b.timestamps[0]! < cutoff) {
        b.timestamps.shift();
      }
      if (b.timestamps.length === 0) map.delete(key);
    }
  }
}

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; retryAfterSec: number; reason: "short" | "long" };

function evaluate(
  map: Map<string, Bucket>,
  key: string,
  cfg: LimiterConfig,
  now: number,
  registerOnAllow: boolean,
): RateLimitResult {
  const bucket = map.get(key) ?? { timestamps: [] };
  const shortCutoff = now - cfg.shortWindowMs;
  const longCutoff = now - cfg.longWindowMs;

  while (bucket.timestamps.length && bucket.timestamps[0]! < longCutoff) {
    bucket.timestamps.shift();
  }

  const shortCount = bucket.timestamps.filter((t) => t >= shortCutoff).length;
  const longCount = bucket.timestamps.length;

  if (shortCount >= cfg.shortLimit) {
    const oldestInWindow = bucket.timestamps.find((t) => t >= shortCutoff)!;
    return {
      allowed: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((oldestInWindow + cfg.shortWindowMs - now) / 1000),
      ),
      reason: "short",
    };
  }
  if (longCount >= cfg.longLimit) {
    const oldestInWindow = bucket.timestamps[0]!;
    return {
      allowed: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((oldestInWindow + cfg.longWindowMs - now) / 1000),
      ),
      reason: "long",
    };
  }

  if (registerOnAllow) {
    bucket.timestamps.push(now);
    map.set(key, bucket);
  }

  return {
    allowed: true,
    remaining: cfg.shortLimit - (shortCount + 1),
    resetAt: now + cfg.shortWindowMs,
  };
}

/**
 * Comprueba si la IP puede enviar una nueva encuesta. Si devuelve `allowed`,
 * registra el hit; si no, no se registra (no penalizamos al ya bloqueado).
 */
export function checkSurveyRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  purgeIfNeeded(now);
  return evaluate(ipBuckets, key, IP_CONFIG, now, true);
}

/**
 * Comprueba si el dispositivo (IP + hash de UA) puede enviar una nueva
 * encuesta. Es la capa que hace cumplir "1 voto cada 15 días" frente a quien
 * borra cookies o abre incógnito en el mismo móvil.
 *
 * Solo se debe llamar después de que el limiter por IP haya pasado, porque
 * registra el hit al permitir el envío.
 */
export function checkSurveyDeviceLimit(key: string): RateLimitResult {
  const now = Date.now();
  return evaluate(deviceBuckets, key, DEVICE_CONFIG, now, true);
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

/**
 * Identidad aproximada del dispositivo: HMAC de `ip|userAgent` truncado.
 * No es un fingerprint perfecto (cambiar de navegador o modo desktop/mobile
 * cambia el UA y se evade), pero captura el caso típico del entrenador que
 * intenta votar varias veces desde el mismo móvil borrando cookies.
 */
export function getDeviceKey(req: Request, ip: string): string {
  const ua = (req.headers.get("user-agent") ?? "").trim().slice(0, 256);
  const secret = process.env.ADMIN_SECRET;
  // Si por algún motivo no hay secret, caemos a una clave determinística
  // (no hasheada). Es peor pero sigue separando dispositivos distintos.
  if (!secret || secret.length < 16) return `${ip}|${ua}`;
  return createHmac("sha256", secret)
    .update(`${ip}|${ua}`)
    .digest("hex")
    .slice(0, 32);
}
