"use client";

import Image from "next/image";
import { formatGtq } from "@/lib/money";
import { useCallback, useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string;
};

export function TiendaClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [studentName, setStudentName] = useState("");
  const [studentNote, setStudentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string; submittedAt: string } | null>(null);

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

  const totalCents = useMemo(() => {
    let t = 0;
    for (const p of products) {
      const q = qty[p.id] ?? 0;
      if (q > 0) t += p.priceCents * q;
    }
    return t;
  }, [products, qty]);

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
        }),
      });
      const j = (await res.json()) as {
        order?: { id: string; submittedAt: string };
        error?: string;
      };
      if (!res.ok) {
        setError(j.error ?? "No se pudo enviar el pedido");
        return;
      }
      if (j.order) {
        setDone(j.order);
        setQty({});
        setStudentName("");
        setStudentNote("");
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
        <p className="mt-2 text-lg font-semibold text-foreground">
          Total: {formatGtq(totalCents)}
        </p>
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
