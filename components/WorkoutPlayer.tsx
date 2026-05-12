"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import type { RutinaPublica, RutinaItemPublico } from "@/components/RutinaListScreen";
import {
  acquireScreenWakeLock,
  feedbackPhaseEnd,
  feedbackWorkoutDone,
} from "@/lib/workout-feedback";

const ROUTINE_FALLBACK_SRC = "/images/routines/placeholder.gif";

function withRoutineFallback(ev: SyntheticEvent<HTMLImageElement>) {
  const img = ev.currentTarget;
  if (img.dataset.fallbackApplied === "1") return;
  img.dataset.fallbackApplied = "1";
  img.src = ROUTINE_FALLBACK_SRC;
}

type WorkoutPlayerProps = {
  rutina: RutinaPublica;
  onClose: () => void;
};

type Phase = "work" | "rest" | "between-exercise" | "done";

function format(s: number): string {
  const sec = Math.max(0, s);
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Descanso por defecto entre ejercicios cuando no se haya configurado. */
const DEFAULT_BETWEEN_EXERCISE_REST = 60;

/**
 * Modo entrenamiento guiado: ocupa toda la pantalla y va llevando al alumno
 * ejercicio por ejercicio, serie por serie, con cronómetro de descanso
 * automático. Mantiene la pantalla encendida con Wake Lock.
 */
export function WorkoutPlayer({ rutina, onClose }: WorkoutPlayerProps) {
  const items = rutina.items;
  const [itemIdx, setItemIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(1); // 1-based, "Serie 1/4".
  const [phase, setPhase] = useState<Phase>("work");
  const [restLeft, setRestLeft] = useState(0);

  // Cuando termina la rutina queremos parar el wake lock; lo guardamos en un ref.
  const releaseWakeLockRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const release = await acquireScreenWakeLock();
      if (cancelled) {
        release();
      } else {
        releaseWakeLockRef.current = release;
      }
    })();
    return () => {
      cancelled = true;
      releaseWakeLockRef.current?.();
      releaseWakeLockRef.current = null;
    };
  }, []);

  // Bloquea el scroll del body mientras el reproductor está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const currentItem: RutinaItemPublico | undefined = items[itemIdx];

  const totalSets = useMemo(
    () => items.reduce((acc, it) => acc + it.sets, 0),
    [items],
  );
  const completedSets = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < itemIdx; i++) acc += items[i]?.sets ?? 0;
    if (phase === "work") acc += setIdx - 1;
    else acc += setIdx; // estamos descansando después de completar setIdx
    return Math.min(acc, totalSets);
  }, [itemIdx, setIdx, phase, items, totalSets]);

  const progressPct = totalSets === 0 ? 0 : Math.round((completedSets / totalSets) * 100);

  // Lógica de countdown durante descanso ("rest" o "between-exercise").
  useEffect(() => {
    if (phase !== "rest" && phase !== "between-exercise") return;
    if (restLeft <= 0) return;
    const id = window.setInterval(() => {
      setRestLeft((s) => {
        const next = s - 1;
        if (next <= 0) {
          feedbackPhaseEnd();
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, restLeft]);

  // Al llegar el descanso a 0 automáticamente avanza.
  useEffect(() => {
    if (restLeft > 0) return;
    if (phase === "rest") {
      // Siguiente serie del mismo ejercicio.
      setPhase("work");
      setSetIdx((s) => s + 1);
    } else if (phase === "between-exercise") {
      // Siguiente ejercicio.
      const next = itemIdx + 1;
      if (next >= items.length) {
        setPhase("done");
        feedbackWorkoutDone();
      } else {
        setItemIdx(next);
        setSetIdx(1);
        setPhase("work");
      }
    }
  }, [restLeft, phase, itemIdx, items.length]);

  const completeSet = useCallback(() => {
    if (!currentItem) return;
    if (setIdx < currentItem.sets) {
      const rest = currentItem.rest_sec ?? 0;
      if (rest > 0) {
        setRestLeft(rest);
        setPhase("rest");
      } else {
        setSetIdx((s) => s + 1);
      }
    } else {
      // Era la última serie del ejercicio.
      const isLast = itemIdx >= items.length - 1;
      if (isLast) {
        setPhase("done");
        feedbackWorkoutDone();
      } else {
        const rest = currentItem.rest_sec ?? DEFAULT_BETWEEN_EXERCISE_REST;
        setRestLeft(rest);
        setPhase("between-exercise");
      }
    }
  }, [currentItem, setIdx, itemIdx, items.length]);

  const skipRest = useCallback(() => {
    if (phase === "rest") {
      setRestLeft(0);
    } else if (phase === "between-exercise") {
      setRestLeft(0);
    }
  }, [phase]);

  const goPrev = useCallback(() => {
    if (phase === "rest" || phase === "between-exercise") {
      setRestLeft(0);
      setPhase("work");
      return;
    }
    if (setIdx > 1) {
      setSetIdx((s) => s - 1);
      return;
    }
    if (itemIdx > 0) {
      const prevIdx = itemIdx - 1;
      const prevItem = items[prevIdx];
      setItemIdx(prevIdx);
      setSetIdx(prevItem?.sets ?? 1);
      setPhase("work");
    }
  }, [phase, setIdx, itemIdx, items]);

  const goNext = useCallback(() => {
    if (itemIdx >= items.length - 1) {
      setPhase("done");
      feedbackWorkoutDone();
      return;
    }
    setItemIdx((i) => i + 1);
    setSetIdx(1);
    setPhase("work");
    setRestLeft(0);
  }, [itemIdx, items.length]);

  // Atajos de teclado para usar en tablet con teclado bluetooth.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (phase === "work") completeSet();
        else if (phase === "rest" || phase === "between-exercise") skipRest();
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase, completeSet, skipRest, goNext, goPrev]);

  if (items.length === 0) {
    return (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-6 text-white"
        role="dialog"
        aria-modal="true"
      >
        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 text-center">
          <p>Esta rutina no tiene ejercicios.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div
        className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-emerald-950 p-6 text-white"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          ¡Rutina completada!
        </h2>
        <p className="text-center text-base text-emerald-200 sm:text-lg">
          {items.length} ejercicio{items.length === 1 ? "" : "s"} · {totalSets} series
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-white px-6 py-3 text-base font-bold text-emerald-900 shadow-xl hover:bg-emerald-50"
        >
          Volver a la rutina
        </button>
      </div>
    );
  }

  if (!currentItem) return null;

  const ex = currentItem.ejercicio;
  const isResting = phase === "rest" || phase === "between-exercise";

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-zinc-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Entrenamiento en curso: ${rutina.nombre}`}
    >
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
        >
          ✕ Salir
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs uppercase tracking-wide text-emerald-300">
            {rutina.nombre}
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
              aria-hidden
            />
          </div>
        </div>
        <p className="shrink-0 text-xs text-zinc-400">
          {completedSets}/{totalSets} series
        </p>
      </header>

      <main className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 px-4 py-4 sm:gap-6 sm:py-6">
        {isResting ? (
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-amber-400/30 bg-amber-950/30 p-6 text-center">
            <p className="text-sm uppercase tracking-wide text-amber-300">
              {phase === "between-exercise" ? "Siguiente ejercicio en…" : "Descanso"}
            </p>
            <p
              className="text-6xl font-bold tabular-nums text-amber-200 sm:text-7xl"
              aria-live="polite"
            >
              {format(restLeft)}
            </p>
            {phase === "between-exercise" && items[itemIdx + 1] ? (
              <p className="text-sm text-amber-100/90">
                Próximo:{" "}
                <strong className="text-white">
                  {items[itemIdx + 1].ejercicio.nombre}
                </strong>{" "}
                · {items[itemIdx + 1].sets} × {items[itemIdx + 1].reps}
              </p>
            ) : (
              <p className="text-sm text-amber-100/90">
                Próxima serie:{" "}
                <strong className="text-white">
                  Serie {setIdx + 1}/{currentItem.sets}
                </strong>{" "}
                · {currentItem.reps} reps
              </p>
            )}
            <button
              type="button"
              onClick={skipRest}
              className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-400 px-5 py-2 text-sm font-bold text-amber-950 hover:bg-amber-300"
            >
              Saltar descanso
            </button>
          </div>
        ) : (
          <>
            <div className="w-full max-w-md text-center">
              <p className="text-xs uppercase tracking-wide text-emerald-400">
                Ejercicio {itemIdx + 1} de {items.length}
              </p>
              <h2 className="mt-1 text-xl font-semibold leading-tight sm:text-2xl">
                {ex.nombre}
              </h2>
            </div>
            <div className="flex w-full max-w-md items-center justify-center overflow-hidden rounded-2xl bg-zinc-900">
              <img
                src={ex.gif_url}
                alt=""
                className="max-h-[40vh] w-full object-contain sm:max-h-[45vh]"
                onError={withRoutineFallback}
              />
            </div>
            <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-900/30 px-4 py-4 text-center">
              <p className="text-xs uppercase tracking-wide text-emerald-300">
                Serie en curso
              </p>
              <p className="text-5xl font-bold tabular-nums text-white sm:text-6xl">
                {setIdx} <span className="text-2xl text-emerald-300">/ {currentItem.sets}</span>
              </p>
              <p className="text-base font-semibold text-emerald-100 sm:text-lg">
                {currentItem.reps} reps
              </p>
              {currentItem.notes ? (
                <p className="mt-1 text-xs text-emerald-200/90">
                  <strong>Nota:</strong> {currentItem.notes}
                </p>
              ) : null}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-white/10 bg-zinc-900/80 px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="min-h-[48px] rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10"
            aria-label="Serie anterior"
          >
            ← Atrás
          </button>
          {!isResting ? (
            <button
              type="button"
              onClick={completeSet}
              className="min-h-[48px] flex-1 rounded-xl bg-emerald-500 px-4 py-2 text-base font-bold text-emerald-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
            >
              {setIdx < currentItem.sets
                ? "Serie hecha ✓"
                : itemIdx < items.length - 1
                  ? "Última serie ✓ · siguiente ejercicio"
                  : "Finalizar rutina"}
            </button>
          ) : (
            <p className="flex-1 text-center text-xs text-zinc-400">
              Espacio = saltar · ← → cambiar ejercicio
            </p>
          )}
          <button
            type="button"
            onClick={goNext}
            className="min-h-[48px] rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10"
            aria-label="Saltar al siguiente ejercicio"
          >
            Siguiente →
          </button>
        </div>
      </footer>
    </div>
  );
}
