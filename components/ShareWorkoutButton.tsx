"use client";

import { useEffect, useState } from "react";

type ShareWorkoutButtonProps = {
  /** Nombre humano de la rutina, p.ej. "Rutina prueba". */
  title: string;
  /** URL absoluta de la rutina (`https://.../rutina?rutina=<id>`). */
  url: string;
};

/**
 * Botón "Compartir" que:
 * 1. Usa la Web Share API nativa si está disponible (móviles).
 * 2. En caso contrario o adicionalmente, abre un modal con un código QR
 *    apuntando a la URL y un botón "Copiar enlace".
 *
 * El QR se genera en cliente con `qrcode` (data URL PNG) para que también
 * funcione si no hay servidor o conectividad.
 */
export function ShareWorkoutButton({ title, url }: ShareWorkoutButtonProps) {
  const [open, setOpen] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const QR = await import("qrcode");
        const dataUrl = await QR.toDataURL(url, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 320,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        if (!cancelled) setQrSrc(dataUrl);
      } catch (err) {
        if (!cancelled) {
          setQrError(
            err instanceof Error ? err.message : "No se pudo generar el QR.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `Rutina: ${title}`,
          text: `Mira esta rutina del gimnasio: ${title}`,
          url,
        });
        return;
      } catch {
        // Si el usuario cancela o falla, abrimos el modal con QR como fallback.
      }
    }
    setOpen(true);
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia este enlace:", url);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleNativeShare}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-emerald-500/60 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
        aria-label="Compartir rutina"
      >
        Compartir
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="share-modal-title"
                className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Compartir rutina
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                aria-label="Cerrar"
              >
                Cerrar
              </button>
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500">{title}</p>
            <div className="mt-4 flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700">
              {qrError ? (
                <p className="py-8 text-center text-xs text-red-700 dark:text-red-300">
                  {qrError}
                </p>
              ) : qrSrc ? (
                <img
                  src={qrSrc}
                  alt={`Código QR para abrir la rutina ${title}`}
                  width={240}
                  height={240}
                  className="h-auto w-full max-w-[240px]"
                />
              ) : (
                <p className="py-8 text-center text-xs text-zinc-500">
                  Generando QR…
                </p>
              )}
            </div>
            <div className="mt-4 break-all rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {url}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyToClipboard}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                {copied ? "¡Copiado!" : "Copiar enlace"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${title}: ${url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg border border-emerald-600 px-3 py-2 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                WhatsApp
              </a>
            </div>
            <p className="mt-3 text-[11px] text-zinc-500">
              El alumno puede escanear el QR con la cámara para abrir la rutina.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
