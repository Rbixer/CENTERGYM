"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type ToastVariant = "info" | "success" | "error";

type ToastItem = { id: string; message: string; variant: ToastVariant };

type PendingConfirm = { message: string; resolve: (value: boolean) => void };

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
  /** Sustituye `window.confirm`: diálogo propio, no del navegador. */
  confirm: (message: string) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return ctx;
}

function newToastId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = newToastId();
      setToasts((t) => [...t, { id, message, variant }]);
      const ms = variant === "error" ? 6500 : 4200;
      window.setTimeout(() => dismissToast(id), ms);
    },
    [dismissToast],
  );

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirm({ message, resolve });
    });
  }, []);

  const finishConfirm = useCallback((value: boolean) => {
    setPendingConfirm((p) => {
      if (p) queueMicrotask(() => p.resolve(value));
      return null;
    });
  }, []);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-[100] flex flex-col items-stretch gap-2 p-3 sm:items-center sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              t.variant === "error"
                ? "pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg dark:border-red-900/60 dark:bg-red-950/90 dark:text-red-100"
                : t.variant === "success"
                  ? "pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-lg dark:border-emerald-900/50 dark:bg-emerald-950/90 dark:text-emerald-100"
                  : "pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            }
          >
            <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => dismissToast(t.id)}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-lg leading-none text-zinc-500 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {pendingConfirm ? (
        <div
          className="fixed inset-0 z-[101] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          onClick={() => finishConfirm(false)}
        >
          <div
            className="max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              id="confirm-dialog-title"
              className="text-sm leading-relaxed text-foreground"
            >
              {pendingConfirm.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => finishConfirm(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => finishConfirm(true)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Sí, continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
