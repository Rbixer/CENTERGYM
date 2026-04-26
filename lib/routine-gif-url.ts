/** Acepta GIF en `public/images/...` o URL absoluta (p. ej. Giphy). */
export function isValidRoutineGifUrl(raw: string): boolean {
  const u = raw.trim();
  if (u.length < 8 || u.length > 800) return false;
  if (u.startsWith("/images/")) return true;
  if (u.startsWith("https://") || u.startsWith("http://")) {
    try {
      const parsed = new URL(u);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }
  return false;
}
