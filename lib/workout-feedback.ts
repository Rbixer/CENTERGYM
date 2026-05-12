/**
 * Pequeñas utilidades de feedback (audio + vibración) compartidas por el
 * `WorkoutPlayer`, el `TabataTimer` y el `RestTimer`. No exporta hooks de
 * React para poder usarse desde callbacks sin re-renders.
 */

/** Reproduce un beep corto. Si el navegador no expone AudioContext, no hace nada. */
export function beep(opts?: { freq?: number; durationMs?: number; gain?: number }) {
  if (typeof window === "undefined") return;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const freq = opts?.freq ?? 880;
    const dur = (opts?.durationMs ?? 500) / 1000;
    const peak = opts?.gain ?? 0.2;
    osc.frequency.value = freq;
    osc.type = "sine";
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + dur,
    );
    osc.connect(gainNode).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
    window.setTimeout(() => ctx.close(), (dur + 0.1) * 1000 + 100);
  } catch {
    // El usuario aún no interactuó con la página (autoplay policy), etc.
  }
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
  try {
    if ("vibrate" in navigator) navigator.vibrate?.(pattern);
  } catch {
    // Algunos navegadores no permiten vibrar fuera de gestos.
  }
}

/** Beep agudo al terminar el descanso / round. */
export function feedbackPhaseEnd() {
  beep({ freq: 880, durationMs: 500 });
  vibrate([200, 80, 200]);
}

/** Triple beep grave al terminar la rutina completa. */
export function feedbackWorkoutDone() {
  beep({ freq: 660, durationMs: 250 });
  window.setTimeout(() => beep({ freq: 660, durationMs: 250 }), 300);
  window.setTimeout(() => beep({ freq: 880, durationMs: 600 }), 600);
  vibrate([300, 100, 300, 100, 600]);
}

/**
 * Solicita Wake Lock para que la pantalla no se apague durante el
 * entrenamiento. Devuelve una función `release()` segura (idempotente).
 * Si el navegador no soporta Wake Lock, devuelve un no-op.
 */
type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener?: (
    type: "release",
    listener: () => void,
  ) => void;
};

export async function acquireScreenWakeLock(): Promise<() => void> {
  if (typeof navigator === "undefined") return () => {};
  const wl = (
    navigator as unknown as {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    }
  ).wakeLock;
  if (!wl) return () => {};
  try {
    let sentinel: WakeLockSentinelLike | null = await wl.request("screen");

    // Si el SO libera el wake lock (cambio de pestaña), lo intentamos
    // reactivar cuando volvemos a `visible`.
    const onVis = async () => {
      if (document.visibilityState === "visible" && sentinel == null) {
        try {
          sentinel = await wl.request("screen");
        } catch {
          // Si falla otra vez, lo aceptamos.
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    sentinel.addEventListener?.("release", () => {
      sentinel = null;
    });

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  } catch {
    return () => {};
  }
}
