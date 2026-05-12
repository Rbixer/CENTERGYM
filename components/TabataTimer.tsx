"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  acquireScreenWakeLock,
  beep,
  feedbackPhaseEnd,
  feedbackWorkoutDone,
} from "@/lib/workout-feedback";

type TabataTimerProps = {
  onClose: () => void;
};

type Phase = "idle" | "prepare" | "work" | "rest" | "done";

const DEFAULTS = {
  prepare: 10,
  work: 20,
  rest: 10,
  rounds: 8,
};

function format(s: number): string {
  const sec = Math.max(0, s);
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Timer libre tipo Tabata/HIIT: prepara + N rondas (trabajo+descanso).
 * Pensado para sesiones rápidas sin rutina formal: el alumno define los
 * intervalos, pulsa Iniciar y obtiene cuenta atrás con beep entre fases.
 */
export function TabataTimer({ onClose }: TabataTimerProps) {
  const [prepare, setPrepare] = useState(DEFAULTS.prepare);
  const [workSec, setWorkSec] = useState(DEFAULTS.work);
  const [restSec, setRestSec] = useState(DEFAULTS.rest);
  const [rounds, setRounds] = useState(DEFAULTS.rounds);

  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0); // 1-based cuando phase = work/rest.
  const [secLeft, setSecLeft] = useState(0);

  const releaseWakeLockRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (phase === "idle" || phase === "done") {
      releaseWakeLockRef.current?.();
      releaseWakeLockRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const release = await acquireScreenWakeLock();
      if (cancelled) release();
      else releaseWakeLockRef.current = release;
    })();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      releaseWakeLockRef.current?.();
      releaseWakeLockRef.current = null;
    };
  }, []);

  // Countdown.
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    if (secLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecLeft((s) => {
        const next = s - 1;
        if (next === 3 || next === 2 || next === 1) {
          beep({ freq: 660, durationMs: 120, gain: 0.15 });
        } else if (next <= 0) {
          feedbackPhaseEnd();
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, secLeft]);

  // Avance de fase.
  useEffect(() => {
    if (secLeft > 0) return;
    if (phase === "prepare") {
      setRound(1);
      setSecLeft(workSec);
      setPhase("work");
      return;
    }
    if (phase === "work") {
      if (round >= rounds) {
        setPhase("done");
        feedbackWorkoutDone();
        return;
      }
      setSecLeft(restSec);
      setPhase("rest");
      return;
    }
    if (phase === "rest") {
      setRound((r) => r + 1);
      setSecLeft(workSec);
      setPhase("work");
    }
  }, [secLeft, phase, workSec, restSec, rounds, round]);

  const start = useCallback(() => {
    setRound(0);
    setSecLeft(prepare > 0 ? prepare : workSec);
    setPhase(prepare > 0 ? "prepare" : "work");
    if (prepare === 0) setRound(1);
  }, [prepare, workSec]);

  const stop = useCallback(() => {
    setPhase("idle");
    setSecLeft(0);
    setRound(0);
  }, []);

  const isRunning = phase === "prepare" || phase === "work" || phase === "rest";

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-zinc-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Cronómetro Tabata"
    >
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
        >
          ✕ Cerrar
        </button>
        <h2 className="text-base font-semibold">Cronómetro Tabata / HIIT</h2>
      </header>

      <main className="flex flex-1 min-h-0 flex-col items-center justify-center px-4 py-4">
        {!isRunning && phase !== "done" ? (
          <div className="w-full max-w-md space-y-4">
            <p className="text-center text-sm text-zinc-400">
              Configura los intervalos y pulsa Iniciar.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Preparación (s)"
                value={prepare}
                min={0}
                max={60}
                onChange={setPrepare}
              />
              <NumberField
                label="Rondas"
                value={rounds}
                min={1}
                max={50}
                onChange={setRounds}
              />
              <NumberField
                label="Trabajo (s)"
                value={workSec}
                min={5}
                max={600}
                onChange={setWorkSec}
              />
              <NumberField
                label="Descanso (s)"
                value={restSec}
                min={0}
                max={600}
                onChange={setRestSec}
              />
            </div>
            <Presets
              onPick={(p) => {
                setPrepare(p.prepare);
                setWorkSec(p.work);
                setRestSec(p.rest);
                setRounds(p.rounds);
              }}
            />
            <button
              type="button"
              onClick={start}
              className="mt-2 w-full rounded-2xl bg-emerald-500 px-4 py-4 text-lg font-bold text-emerald-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
            >
              Iniciar
            </button>
            <p className="text-center text-xs text-zinc-500">
              Total estimado:{" "}
              <strong className="text-zinc-300">
                {format(prepare + rounds * workSec + Math.max(0, rounds - 1) * restSec)}
              </strong>
            </p>
          </div>
        ) : phase === "done" ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <p className="text-3xl font-extrabold sm:text-4xl">¡Terminado!</p>
            <p className="text-sm text-emerald-200">
              {rounds} rondas · {format(workSec)} trabajo · {format(restSec)} descanso
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={start}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-base font-bold text-emerald-950 hover:bg-emerald-400"
              >
                Repetir
              </button>
              <button
                type="button"
                onClick={stop}
                className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-base font-medium hover:bg-white/10"
              >
                Volver a configurar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-md flex-col items-center gap-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">
              {phase === "prepare"
                ? "Preparación"
                : phase === "work"
                  ? `Trabajo · Ronda ${round}/${rounds}`
                  : `Descanso · Ronda ${round}/${rounds}`}
            </p>
            <p
              className={`text-7xl font-bold tabular-nums sm:text-8xl ${
                phase === "work"
                  ? "text-emerald-300"
                  : phase === "rest"
                    ? "text-amber-300"
                    : "text-white"
              }`}
              aria-live="polite"
            >
              {format(secLeft)}
            </p>
            <div className="mt-4 grid w-full grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSecLeft(0)}
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10"
              >
                Saltar fase
              </button>
              <button
                type="button"
                onClick={stop}
                className="rounded-xl border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm font-medium text-red-100 hover:bg-red-900/50"
              >
                Detener
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-xs font-medium text-zinc-300">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(min, Math.min(max, Math.round(n))));
        }}
        className="mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2 text-base text-white"
      />
    </label>
  );
}

type Preset = { label: string; prepare: number; work: number; rest: number; rounds: number };

const PRESETS: Preset[] = [
  { label: "Tabata clásico", prepare: 10, work: 20, rest: 10, rounds: 8 },
  { label: "EMOM 10min", prepare: 10, work: 50, rest: 10, rounds: 10 },
  { label: "Fuerza 4×30", prepare: 10, work: 30, rest: 90, rounds: 4 },
];

function Presets({ onPick }: { onPick: (p: Preset) => void }) {
  return (
    <div>
      <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">
        Presets
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onPick(p)}
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium hover:bg-white/10"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
