import { createHmac, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "encuesta_admin";

function getSecret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_SECRET debe tener al menos 16 caracteres");
  }
  return s;
}

export function createAdminToken(): string {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string): boolean {
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

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  };
}

/** Debe usarse en el mismo NextResponse que se devuelve (Route Handlers). */
export function attachAdminSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(ADMIN_COOKIE, token, adminSessionCookieOptions());
}

export async function isAdminSession(): Promise<boolean> {
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(c && verifyAdminToken(c));
}

export function clearAdminSessionCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, "", {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });
}

export function assertAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  if (password.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  } catch {
    return false;
  }
}
