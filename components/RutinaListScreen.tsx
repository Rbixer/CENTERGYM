"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import {
  normalizeRoutineCategory,
  routineCategoryLabel,
} from "@/lib/routine-categories";
import type { RoutineCategoryId } from "@/lib/routine-categories";

export type RutinaPublica = {
  id: string;
  nombre: string;
  descripcion: string;
  gif_url: string;
  categoria: string;
};

function RoutineDetailCard({ r }: { r: RutinaPublica }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex min-w-0 flex-col gap-0 md:flex-row md:items-stretch">
        <div className="flex w-full min-w-0 shrink-0 items-center justify-center bg-zinc-100 p-2 sm:p-3 dark:bg-zinc-800 md:max-w-[min(100%,24rem)] md:basis-[42%] lg:max-w-[min(100%,28rem)] lg:basis-2/5">
          <img
            src={r.gif_url}
            alt={r.nombre}
            className="h-auto w-full max-h-[min(70vh,520px)] object-contain md:max-h-[min(90vh,720px)]"
            loading="eager"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:p-5 md:pl-2 md:pr-6 md:py-6 lg:pl-0">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            {routineCategoryLabel(normalizeRoutineCategory(r.categoria))}
          </p>
          <h3 className="mt-1.5 text-xl font-semibold leading-snug text-foreground md:text-2xl">
            {r.nombre}
          </h3>
          <p className="mt-2.5 text-base font-normal leading-relaxed text-zinc-600 dark:text-zinc-300">
            {r.descripcion}
          </p>
        </div>
      </div>
    </article>
  );
}

type RutinaListScreenProps = {
  /** null = todas las rutinas */
  categoryId: RoutineCategoryId | null;
  focusedRoutineId: string | null;
  onFocusedChange: (id: string | null) => void;
};

export function RutinaListScreen({
  categoryId,
  focusedRoutineId,
  onFocusedChange,
}: RutinaListScreenProps) {
  const [rutinas, setRutinas] = useState<RutinaPublica[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rutinas", { cache: "no-store" });
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

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const detalleRef = useRef<HTMLDivElement | null>(null);
  const listadoRef = useRef<HTMLDivElement | null>(null);

  const filtradas = useMemo(() => {
    if (categoryId === null) return rutinas;
    return rutinas.filter(
      (r) => normalizeRoutineCategory(r.categoria) === categoryId,
    );
  }, [rutinas, categoryId]);

  const selected = useMemo(
    () => (focusedRoutineId ? filtradas.find((r) => r.id === focusedRoutineId) : undefined),
    [filtradas, focusedRoutineId],
  );

  const scrollListadoIntoView = useCallback(() => {
    window.setTimeout(() => {
      listadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, []);

  useEffect(() => {
    if (!selected || !focusedRoutineId) return;
    const el = detalleRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(t);
  }, [selected, focusedRoutineId]);

  const didInitScroll = useRef(false);
  useEffect(() => {
    if (loading || didInitScroll.current) return;
    if (categoryId === null) {
      didInitScroll.current = true;
      return;
    }
    if (focusedRoutineId) return;
    if (rutinas.length > 0) {
      didInitScroll.current = true;
      scrollListadoIntoView();
    }
  }, [
    loading,
    categoryId,
    focusedRoutineId,
    rutinas.length,
    scrollListadoIntoView,
  ]);

  if (loading) {
    return (
      <p className="py-10 text-center text-sm text-zinc-500">Cargando rutinas…</p>
    );
  }

  const labelCat =
    categoryId === null
      ? "Todas las categorías"
      : routineCategoryLabel(categoryId);

  const emptyListMessage =
    rutinas.length === 0
      ? categoryId === null
        ? "Aún no hay rutinas publicadas. Cuando el gimnasio las cree en administración, aparecerán aquí."
        : `Aún no hay rutinas en «${labelCat}».`
      : `No hay rutinas en «${labelCat}».`;

  return (
    <div className="space-y-6">
      <div
        ref={listadoRef}
        id="rutina-listado"
        className="space-y-4 scroll-mt-4"
      >
        {focusedRoutineId && !selected ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-950/20 px-4 py-5 text-center dark:border-amber-900/40">
            <p className="text-sm text-amber-950 dark:text-amber-100">
              Esta rutina no está en el listado actual. Vuelve a elegirla en la lista.
            </p>
            <button
              type="button"
              onClick={() => {
                onFocusedChange(null);
                scrollListadoIntoView();
              }}
              className="mt-3 text-sm font-medium text-emerald-800 underline dark:text-emerald-400"
            >
              Volver al listado
            </button>
          </div>
        ) : null}

        {focusedRoutineId && selected ? (
          <div
            ref={detalleRef}
            id="rutina-detalle"
            className="space-y-4 scroll-mt-4"
          >
            <button
              type="button"
              onClick={() => {
                onFocusedChange(null);
                scrollListadoIntoView();
              }}
              className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 sm:inline-flex sm:w-auto dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              ← Volver al listado
            </button>
            <RoutineDetailCard r={selected} />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-900/20 px-4 py-6 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{emptyListMessage}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                Actualizar listado
              </button>
            </div>
          </div>
        ) : (
          <section aria-labelledby="rutinas-lista-titulo">
            <h2
              id="rutinas-lista-titulo"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              {categoryId === null
                ? "Todas las rutinas — toca una para el detalle"
                : "Rutinas en esta categoría — toca una para el detalle"}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">Contenido publicado por el gimnasio.</p>
            <ul className="mt-3 flex flex-col gap-2">
              {filtradas.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onFocusedChange(r.id)}
                    className="flex w-full min-h-[3rem] items-stretch gap-3 rounded-xl border border-zinc-200 bg-white p-2.5 text-left transition hover:border-emerald-400/60 hover:bg-emerald-50/40 active:scale-[0.99] dark:border-zinc-600 dark:bg-zinc-900/50 dark:hover:border-emerald-700/50 dark:hover:bg-emerald-950/20"
                  >
                    <div
                      className="relative flex h-28 w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100 p-1.5 sm:h-32 sm:w-36 dark:border-zinc-600/60 dark:bg-zinc-950/80"
                      aria-hidden
                    >
                      <img
                        src={r.gif_url}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5 sm:py-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-emerald-700 sm:text-sm dark:text-emerald-400">
                        {routineCategoryLabel(normalizeRoutineCategory(r.categoria))}
                      </span>
                      <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {r.nombre}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-zinc-600 sm:text-base dark:text-zinc-400">
                        {r.descripcion}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
