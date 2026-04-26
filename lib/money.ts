/** Quetzales (GTQ). `amountCents` = centavos (1 Q = 100 centavos). */
export function formatGtq(amountCents: number): string {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

/** Acepta coma o punto (ej. "25,50" o "10") → centavos de quetzal. */
export function parseQuetzalesToCents(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
