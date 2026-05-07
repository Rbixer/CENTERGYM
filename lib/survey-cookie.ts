import { createHmac, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";

/**
 * Cookie firmada de "este navegador ya envió la encuesta".
 *
 * - Es solo un disuasor: alguien técnico puede borrar cookies o usar incógnito.
 *   Se combina con el rate-limit por IP para cubrir ambos lados.
 * - Se firma con HMAC-SHA256 usando `ADMIN_SECRET` (mismo patrón que `lib/auth.ts`).
 */

export const SURVEY_DONE_COOKIE = "encuesta_done";

const SURVEY_DONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function getSecret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_SECRET debe tener al menos 16 caracteres");
  }
  return s;
}

export function createSurveyDoneToken(): string {
  const exp = Date.now() + SURVEY_DONE_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySurveyDoneToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!payload || !sig) return false;

  let expected: string;
  try {
    expected = createHmac("sha256", getSecret())
      .update(payload)
      .digest("base64url");
  } catch {
    return false;
  }
  try {
    if (expected.length !== sig.length) return false;
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
  } catch {
    return false;
  }
  try {
    const { exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp: number };
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function attachSurveyDoneCookie(res: NextResponse, token: string) {
  res.cookies.set(SURVEY_DONE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SURVEY_DONE_TTL_MS / 1000),
  });
}
