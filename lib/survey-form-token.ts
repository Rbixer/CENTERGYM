import { createHmac, timingSafeEqual } from "crypto";

/**
 * Token efímero que se emite cuando se renderiza /encuesta y se exige al
 * `POST /api/public/submit`. Sirve para 2 cosas:
 *
 * 1. Frenar bots que envían POST directos sin abrir la página.
 * 2. Honeypot temporal: el endpoint rechaza envíos cuya distancia desde la
 *    emisión del token sea irrealmente corta (< 2 s) o demasiado vieja (> 6 h).
 *
 * Se firma con HMAC-SHA256 + `ADMIN_SECRET`.
 */

const FORM_TOKEN_MIN_AGE_MS = 2_000; // 2 s mínimo entre carga y envío
const FORM_TOKEN_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 h máximo

function getSecret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_SECRET debe tener al menos 16 caracteres");
  }
  return s;
}

export function createSurveyFormToken(): string {
  const iat = Date.now();
  const payload = Buffer.from(JSON.stringify({ iat }), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export type FormTokenCheck =
  | { ok: true }
  | { ok: false; reason: "missing" | "invalid" | "too_fast" | "expired" };

export function verifySurveyFormToken(token: unknown): FormTokenCheck {
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "missing" };
  }
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "invalid" };
  const [payload, sig] = parts;
  if (!payload || !sig) return { ok: false, reason: "invalid" };

  let expected: string;
  try {
    expected = createHmac("sha256", getSecret())
      .update(payload)
      .digest("base64url");
  } catch {
    return { ok: false, reason: "invalid" };
  }
  try {
    if (expected.length !== sig.length) return { ok: false, reason: "invalid" };
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
      return { ok: false, reason: "invalid" };
    }
  } catch {
    return { ok: false, reason: "invalid" };
  }

  let iat: number;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { iat?: number };
    if (typeof decoded.iat !== "number" || !Number.isFinite(decoded.iat)) {
      return { ok: false, reason: "invalid" };
    }
    iat = decoded.iat;
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const age = Date.now() - iat;
  if (age < FORM_TOKEN_MIN_AGE_MS) return { ok: false, reason: "too_fast" };
  if (age > FORM_TOKEN_MAX_AGE_MS) return { ok: false, reason: "expired" };

  return { ok: true };
}
