"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RestTimerProps = {
  /** Segundos a contar hacia abajo. */
  seconds: number;
};

function format(s: number): string {
  const sign = s < 0 ? "-" : "";
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  return `${sign}${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Cronómetro de descanso para una serie. Cuenta hacia 0 y, al llegar,
 * vibra el teléfono (si lo permite) y reproduce un beep corto.
 *
 * Mantiene la cuenta en `ref` para evitar drift cuando el navegador
 * pausa setInterval en background, recalculando con `Date.now()`.
 */
export function RestTimer({ seconds }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const endAtRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const beepedRef = useRef(false);

  const stopTick = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (running) return;
    beepedRef.current = false;
    endAtRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  }, [running, remaining]);

  const pause = useCallback(() => {
    if (!running) return;
    if (endAtRef.current != null) {
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
    }
    endAtRef.current = null;
    setRunning(false);
  }, [running]);

  const reset = useCallback(() => {
    endAtRef.current = null;
    setRunning(false);
    setRemaining(seconds);
    beepedRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (!running) {
      stopTick();
      return;
    }
    tickRef.current = window.setInterval(() => {
      if (endAtRef.current == null) return;
      const left = Math.round((endAtRef.current - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0 && !beepedRef.current) {
        beepedRef.current = true;
        try {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.([200, 80, 200]);
          }
        } catch {}
        try {
          const Ctx =
            typeof window !== "undefined"
              ? (window.AudioContext ||
                  (window as unknown as { webkitAudioContext?: typeof AudioContext })
                    .webkitAudioContext)
              : undefined;
          if (Ctx) {
            const ctx = new Ctx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 880;
            osc.type = "sine";
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.55);
            window.setTimeout(() => ctx.close(), 800);
          }
        } catch {}
      }
    }, 250);
    return stopTick;
  }, [running, stopTick]);

  // Sincroniza si cambia el prop (cambia el item).
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const done = running && remaining <= 0;
  const bigLabel = format(remaining);

  return (
    <div
      className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${
        done
          ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
          : running
            ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
            : "border-zinc-300 bg-white text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      }`}
      role="timer"
      aria-live="polite"
    >
      <span
        className={`tabular-nums ${done ? "font-bold" : ""}`}
        aria-label={`Tiempo restante de descanso: ${bigLabel}`}
      >
        {bigLabel}
      </span>
      {!running ? (
        <button
          type="button"
          onClick={start}
          className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          Iniciar descanso
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={pause}
            className="rounded-md border border-amber-400 bg-white px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-zinc-900 dark:text-amber-100"
          >
            Pausar
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          >
            Reiniciar
          </button>
        </>
      )}
    </div>
  );
}
