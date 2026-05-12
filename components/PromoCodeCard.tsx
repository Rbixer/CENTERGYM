"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  code: string;
  discountType: string;
  discountValue: number;
  minSubtotalLabel: string | null;
  validUntil: string | null;
  usesLeft: number | null;
};

function discountText(type: string, value: number): string {
  if (type === "percent") return `${value}%`;
  if (type === "fixed") {
    const q = (value / 100).toLocaleString("es-GT", { minimumFractionDigits: 2 });
    return `Q${q}`;
  }
  return "100%";
}

function discountSubtext(type: string): string {
  if (type === "free") return "de descuento";
  return "de descuento";
}

/**
 * Tarjeta promocional usada en /promos. El "ticket" central muestra el código
 * en grande con un dashed-border tipo cupón. Tap para copiar y CTA para
 * abrir la tienda con el código pre-aplicado.
 */
export function PromoCodeCard({
  code,
  discountType,
  discountValue,
  minSubtotalLabel,
  validUntil,
  usesLeft,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* no-op */
    }
  }

  const validityText = validUntil
    ? `Hasta ${new Date(validUntil).toLocaleDateString("es-GT", {
        day: "2-digit",
        month: "short",
      })}`
    : null;

  return (
    <li className="group relative overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 p-5 shadow-md transition hover:shadow-lg dark:border-amber-700 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-amber-900/30">
      {/* Halo decorativo */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-300/30 blur-2xl" />

      <div className="relative flex items-baseline gap-2">
        <span className="text-4xl font-black text-amber-900 dark:text-amber-200 sm:text-5xl">
          {discountText(discountType, discountValue)}
        </span>
        <span className="text-sm font-semibold text-amber-800/80 dark:text-amber-200/80">
          {discountSubtext(discountType)}
        </span>
      </div>

      {minSubtotalLabel ? (
        <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/70">
          En compras desde {minSubtotalLabel}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copiar código ${code}`}
        className="relative mt-4 flex w-full items-center justify-center rounded-xl border-2 border-dashed border-amber-500/60 bg-white/80 px-3 py-3 transition hover:bg-white dark:border-amber-600/60 dark:bg-zinc-900/60 dark:hover:bg-zinc-900"
      >
        <code className="text-lg font-bold tracking-[0.18em] text-amber-900 sm:text-xl dark:text-amber-200">
          {code}
        </code>
        <span className="ml-2 text-[10px] font-semibold uppercase text-amber-700/80 dark:text-amber-300/80">
          {copied ? "¡copiado!" : "tocar"}
        </span>
      </button>

      <Link
        href={`/tienda?promo=${encodeURIComponent(code)}`}
        className="mt-3 flex w-full items-center justify-center rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500"
      >
        Usar ahora →
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-800/70 dark:text-amber-200/60">
        {validityText ? <span>{validityText}</span> : <span />}
        {usesLeft != null && usesLeft <= 20 ? (
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900 dark:bg-amber-900 dark:text-amber-100">
            ¡Quedan {usesLeft}!
          </span>
        ) : null}
      </div>
    </li>
  );
}
