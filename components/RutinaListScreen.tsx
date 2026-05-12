"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { parseResponseJson } from "@/lib/parse-response-json";
import {
  normalizeRoutineCategory,
  routineCategoryLabel,
} from "@/lib/routine-categories";
import type { RoutineCategoryId } from "@/lib/routine-categories";

const ROUTINE_FALLBACK_SRC = "/images/routines/placeholder.gif";

function withRoutineFallback(ev: SyntheticEvent<HTMLImageElement>) {
  const img = ev.currentTarget;
  if (img.dataset.fallbackApplied === "1") return;
  img.dataset.fallbackApplied = "1";
  img.src = ROUTINE_FALLBACK_SRC;
}

/** Forma de cada ejercicio dentro de una rutina-sesión (público). */
export type EjercicioPublico = {
  id: string;
  nombre: string;
  descripcion: string;
  gif_url: string;
  categoria: string;
};

/** Item de una rutina-sesión: ejercicio + series/reps/descanso/nota. */
export type RutinaItemPublico = {
  id: string;
  sets: number;
  reps: string;
  rest_sec: number | null;
  notes: string | null;
  ejercicio: EjercicioPublico;
};

/** Rutina-sesión completa (Workout en BD). */
export type RutinaPublica = {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  items: RutinaItemPublico[];
};

function RoutineItemCard({
  item,
  index,
}: {
  item: RutinaItemPublico;
  index: number;
}) {
  const ex = item.ejercicio;
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex min-w-0 flex-col gap-0 md:flex-row md:items-stretch">
        <div className="flex w-full min-w-0 shrink-0 items-center justify-center bg-zinc-100 p-2 sm:p-3 dark:bg-zinc-800 md:max-w-[min(100%,22rem)] md:basis-[40%]">
          <img
            src={ex.gif_url}
            alt={ex.nombre}
            className="h-auto w-full max-h-[min(60vh,440px)] object-contain"
            loading="lazy"
            onError={withRoutineFallback}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:p-5 md:py-6">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-600/15 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Ejercicio {index + 1}
            </span>
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              {routineCategoryLabel(normalizeRoutineCategory(ex.categoria))}
            </span>
          </div>
          <h3 className="mt-1.5 text-lg font-semibold leading-snug text-foreground md:text-xl">
            {ex.nombre}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white shadow-sm">
              {item.sets} series × {item.reps} reps
            </span>
            {item.rest_sec ? (
              <span className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
                Descanso {item.rest_sec}s
              </span>
            ) : null}
          </div>

          {item.notes ? (
            <p className="mt-3 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100">
              <strong className="font-semibold">Nota: </strong>
              {item.notes}
            </p>
          ) : null}

          {ex.descripcion ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {ex.descripcion}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function WorkoutDetailCard({ r }: { r: RutinaPublica }) {
  const totalSets = r.items.reduce((acc, it) => acc + it.sets, 0);
  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-emerald-700/30 bg-emerald-950/30 px-4 py-4 text-emerald-50/90 sm:px-5 sm:py-5">
        <p className="text-xs uppercase tracking-wide text-emerald-300">
          {routineCategoryLabel(normalizeRoutineCategory(r.categoria))}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
          {r.nombre}
        </h2>
        {r.descripcion ? (
          <p className="mt-2 text-sm leading-relaxed text-emerald-100/90">
            {r.descripcion}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-emerald-200/80">
          {r.items.length} ejercicio{r.items.length === 1 ? "" : "s"} ·{" "}
          {totalSets} series totales
        </p>
      </header>

      {r.items.length === 0 ? (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-5 text-center text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
          Esta rutina aún no tiene ejercicios cargados.
        </p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Ejercicios de la rutina">
          {r.items.map((it, i) => (
            <li key={it.id}>
              <RoutineItemCard item={it} index={i} />
            </li>
          ))}
        </ol>
      )}
    </div>
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
            <WorkoutDetailCard r={selected} />
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
                ? "Todas las rutinas — toca una para ver los ejercicios"
                : "Rutinas en esta categoría — toca una para ver los ejercicios"}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">Contenido publicado por el gimnasio.</p>
            <ul className="mt-3 flex flex-col gap-2">
              {filtradas.map((r) => {
                const previewGif = r.items[0]?.ejercicio.gif_url ?? ROUTINE_FALLBACK_SRC;
                return (
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
                          src={previewGif}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                          onError={withRoutineFallback}
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5 sm:py-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-emerald-700 sm:text-sm dark:text-emerald-400">
                          {routineCategoryLabel(normalizeRoutineCategory(r.categoria))}
                        </span>
                        <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                          {r.nombre}
                        </span>
                        <span className="mt-0.5 text-xs text-zinc-500">
                          {r.items.length} ejercicio
                          {r.items.length === 1 ? "" : "s"}
                        </span>
                        {r.descripcion ? (
                          <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-zinc-600 sm:text-base dark:text-zinc-400">
                            {r.descripcion}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
