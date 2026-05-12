"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { parseResponseJson } from "@/lib/parse-response-json";
import {
  ROUTINE_CATEGORIES,
  normalizeRoutineCategory,
} from "@/lib/routine-categories";
import type { RutinaPublica } from "@/components/RutinaListScreen";

export function RutinaCategoryPicker() {
  const [rutinas, setRutinas] = useState<RutinaPublica[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workouts", { cache: "no-store" });
      const parsed = await parseResponseJson<{ rutinas?: RutinaPublica[]; error?: string }>(
        res,
      );
      if (parsed.parseError || !parsed.body || !parsed.ok) {
        setRutinas([]);
        return;
      }
      setRutinas(parsed.body.rutinas ?? []);
    } catch {
      setRutinas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className="py-10 text-center text-sm text-zinc-500">Cargando tipos de rutina…</p>
    );
  }

  return (
    <section
      aria-label="Catálogo por tipo de rutina"
      className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
    >
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Elige el tipo de rutina
      </h2>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Toca un tipo: se abrirá la pantalla con las rutinas de esa zona. «Todas» muestra el listado
        completo.
      </p>
      <ul className="mt-3 flex flex-col gap-2" role="list" aria-label="Categorías de rutina">
        <li>
          <Link
            href="/rutina/todas"
            className="flex w-full min-h-[48px] items-center justify-between gap-3 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-800 transition hover:border-zinc-400 active:scale-[0.99] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500"
          >
            <span>Todas las rutinas</span>
            <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-normal tabular-nums text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              {rutinas.length}
            </span>
          </Link>
        </li>
        {ROUTINE_CATEGORIES.map((c) => {
          const count = rutinas.filter(
            (r) => normalizeRoutineCategory(r.categoria) === c.id,
          ).length;
          return (
            <li key={c.id}>
              <Link
                href={`/rutina/categoria/${c.id}`}
                title={c.hint}
                className="flex w-full min-h-[48px] items-center justify-between gap-3 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-left text-zinc-800 transition hover:border-emerald-500/50 hover:bg-emerald-50/30 active:scale-[0.99] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-emerald-600/40 dark:hover:bg-emerald-950/20"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{c.label}</span>
                  <span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    {c.hint}
                  </span>
                </span>
                <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-xs tabular-nums text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {count === 0 ? "—" : count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
