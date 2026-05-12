"use client";

import Image from "next/image";
import { formatGtq } from "@/lib/money";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Product = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string;
};

type PromoState =
  | { status: "idle" }
  | { status: "validating" }
  | {
      status: "ok";
      code: string;
      discountCents: number;
      totalCents: number;
      description: string;
      kind: string;
    }
  | { status: "error"; message: string };

type CompletedOrder = {
  id: string;
  submittedAt: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  promoCode: string | null;
};

export function TiendaClient() {
  const searchParams = useSearchParams();
  const initialPromo = (searchParams?.get("promo") ?? "").trim().toUpperCase();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [studentName, setStudentName] = useState("");
  const [studentNote, setStudentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<CompletedOrder | null>(null);

  const [promoInput, setPromoInput] = useState(initialPromo);
  const [promoState, setPromoState] = useState<PromoState>({ status: "idle" });

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/public/products", { cache: "no-store" });
      const j = (await res.json()) as { products?: Product[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? "No se pudo cargar el catálogo");
      setProducts(j.products ?? []);
    } catch {
      setError("Error de red al cargar productos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const linesPayload = useMemo(() => {
    return Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
  }, [qty]);

  const subtotalCents = useMemo(() => {
    let t = 0;
    for (const p of products) {
      const q = qty[p.id] ?? 0;
      if (q > 0) t += p.priceCents * q;
    }
    return t;
  }, [products, qty]);

  /**
   * Si la promo ya estaba aplicada y el subtotal cambia (añadir/quitar items),
   * la recalculamos: o se actualiza el descuento o, si ya no se cumplen las
   * reglas (mínimo), la quitamos automáticamente y avisamos.
   */
  useEffect(() => {
    if (promoState.status !== "ok") return;
    const code = promoState.code;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/promo/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, subtotalCents }),
        });
        const j = (await res.json()) as {
          ok?: boolean;
          message?: string;
          discountCents?: number;
          totalCents?: number;
          description?: string;
          kind?: string;
        };
        if (cancelled) return;
        if (!j.ok) {
          setPromoState({
            status: "error",
            message: j.message ?? "Tu código ya no aplica.",
          });
          return;
        }
        setPromoState({
          status: "ok",
          code,
          discountCents: j.discountCents ?? 0,
          totalCents: j.totalCents ?? subtotalCents,
          description: j.description ?? "",
          kind: j.kind ?? "store",
        });
      } catch {
        /* error de red: dejamos el estado como estaba */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subtotalCents, promoState.status === "ok" ? promoState.code : null]);

  const discountCents = promoState.status === "ok" ? promoState.discountCents : 0;
  const totalCents = Math.max(0, subtotalCents - discountCents);

  async function validatePromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoState({ status: "validating" });
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotalCents }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        message?: string;
        discountCents?: number;
        totalCents?: number;
        description?: string;
        kind?: string;
        error?: string;
      };
      if (res.status === 429) {
        setPromoState({
          status: "error",
          message: "Demasiados intentos. Espera unos minutos.",
        });
        return;
      }
      if (!j.ok) {
        setPromoState({
          status: "error",
          message: j.message ?? j.error ?? "Código no válido.",
        });
        return;
      }
      setPromoState({
        status: "ok",
        code,
        discountCents: j.discountCents ?? 0,
        totalCents: j.totalCents ?? subtotalCents,
        description: j.description ?? "",
        kind: j.kind ?? "store",
      });
    } catch {
      setPromoState({ status: "error", message: "Error de red al validar." });
    }
  }

  function clearPromo() {
    setPromoInput("");
    setPromoState({ status: "idle" });
  }

  // Auto-validar el código pasado por URL (`?promo=XXX`) cuando ya tengamos
  // productos cargados (para que el subtotal sea consistente).
  useEffect(() => {
    if (!initialPromo) return;
    if (products.length === 0) return;
    if (promoState.status !== "idle") return;
    void validatePromo();
    // intencional: solo al cargar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  function setProductQty(id: string, next: number) {
    setQty((prev) => {
      const q = Math.max(0, Math.min(99, Math.floor(next)));
      if (q === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: q };
    });
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: studentName.trim() || null,
          studentNote: studentNote.trim() || null,
          lines: linesPayload,
          promoCode: promoState.status === "ok" ? promoState.code : null,
        }),
      });
      const j = (await res.json()) as {
        order?: { id: string; submittedAt: string };
        pricing?: {
          subtotalCents: number;
          discountCents: number;
          totalCents: number;
          promoCode: string | null;
        };
        error?: string;
        promoError?: string;
      };
      if (!res.ok) {
        // Si el error es del código (p.ej. otro lo canjeó justo antes que tú),
        // refrescamos el estado de promo para que el alumno vea por qué.
        if (j.promoError) {
          setPromoState({ status: "error", message: j.error ?? "Tu código ya no aplica." });
        }
        setError(j.error ?? "No se pudo enviar el pedido");
        return;
      }
      if (j.order && j.pricing) {
        setDone({
          id: j.order.id,
          submittedAt: j.order.submittedAt,
          subtotalCents: j.pricing.subtotalCents,
          discountCents: j.pricing.discountCents,
          totalCents: j.pricing.totalCents,
          promoCode: j.pricing.promoCode,
        });
        setQty({});
        setStudentName("");
        setStudentNote("");
        setPromoInput("");
        setPromoState({ status: "idle" });
      }
    } catch {
      setError("Error de red al enviar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
          Pedido enviado
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Referencia: <span className="font-mono text-foreground">{done.id}</span>
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {new Date(done.submittedAt).toLocaleString("es-GT")}
        </p>
        <dl className="mx-auto mt-4 max-w-xs space-y-1 rounded-xl border border-emerald-200 bg-white/70 p-3 text-left text-sm dark:border-emerald-900 dark:bg-zinc-900/40">
          <div className="flex justify-between">
            <dt className="text-zinc-600 dark:text-zinc-400">Subtotal</dt>
            <dd className="font-medium">{formatGtq(done.subtotalCents)}</dd>
          </div>
          {done.discountCents > 0 ? (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
              <dt>
                Descuento{done.promoCode ? ` (${done.promoCode})` : ""}
              </dt>
              <dd className="font-medium">− {formatGtq(done.discountCents)}</dd>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between border-t border-emerald-200 pt-2 text-base dark:border-emerald-900">
            <dt className="font-semibold">Total</dt>
            <dd className="font-bold">{formatGtq(done.totalCents)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          El gimnasio revisará tu pedido. Puedes cerrar esta página.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(null);
            void refresh();
          }}
          className="mt-6 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Hacer otro pedido
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">Cargando productos…</p>
    );
  }

  if (products.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
        Aún no hay productos publicados. Vuelve más tarde.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2">
        {products.map((p) => {
          const q = qty[p.id] ?? 0;
          return (
            <li
              key={p.id}
              className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50"
            >
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <Image
                  src={p.imageUrl}
                  alt={p.name}
                  fill
                  className="object-cover"
                  sizes="96px"
                  unoptimized
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                  <p className="font-medium leading-snug">{p.name}</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatGtq(p.priceCents)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Menos"
                    onClick={() => setProductQty(p.id, q - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 text-lg leading-none dark:border-zinc-600"
                  >
                    −
                  </button>
                  <span className="w-8 text-center tabular-nums text-sm font-medium">{q}</span>
                  <button
                    type="button"
                    aria-label="Más"
                    onClick={() => setProductQty(p.id, q + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 text-lg leading-none dark:border-zinc-600"
                  >
                    +
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Tu pedido
        </h2>

        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
            <span className="font-medium">{formatGtq(subtotalCents)}</span>
          </div>
          {promoState.status === "ok" && discountCents > 0 ? (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
              <span>Descuento ({promoState.code})</span>
              <span className="font-medium">− {formatGtq(discountCents)}</span>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between border-t border-zinc-200 pt-2 text-base dark:border-zinc-700">
            <span className="font-semibold">Total</span>
            <span className="font-bold">{formatGtq(totalCents)}</span>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium">
            Código de promoción (opcional)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => {
                setPromoInput(e.target.value.toUpperCase());
                if (promoState.status === "error" || promoState.status === "ok") {
                  setPromoState({ status: "idle" });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void validatePromo();
                }
              }}
              maxLength={32}
              placeholder="EJ. VERANO20"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase tracking-wider dark:border-zinc-600 dark:bg-zinc-900"
              disabled={promoState.status === "validating" || promoState.status === "ok"}
            />
            {promoState.status === "ok" ? (
              <button
                type="button"
                onClick={clearPromo}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                Quitar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void validatePromo()}
                disabled={promoState.status === "validating" || !promoInput.trim()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {promoState.status === "validating" ? "…" : "Aplicar"}
              </button>
            )}
          </div>
          {promoState.status === "ok" ? (
            <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              ✓ Código aplicado{promoState.description ? `: ${promoState.description}` : "."}
            </p>
          ) : null}
          {promoState.status === "error" ? (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {promoState.message}
            </p>
          ) : null}
        </div>

        <label className="mt-4 block text-sm font-medium">
          Nombre (opcional)
          <input
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="Para identificar tu pedido"
          />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Notas (opcional)
          <textarea
            value={studentNote}
            onChange={(e) => setStudentNote(e.target.value)}
            maxLength={500}
            rows={3}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            placeholder="Talla, sabor, horario de recogida…"
          />
        </label>
        <button
          type="button"
          disabled={submitting || linesPayload.length === 0}
          onClick={() => void submit()}
          className="mt-4 w-full rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Enviando…" : "Enviar pedido"}
        </button>
      </section>
    </div>
  );
}
