"use client";

import { useCallback, useEffect, useState } from "react";

/** Evento no estándar pero soportado en Chromium (Android Chrome, Edge, etc.). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Mostrado solo en /admin/login. Permite instalar el panel admin como PWA
 * separada de la app del cliente:
 * - Si Chrome dispara `beforeinstallprompt`, ofrecemos un botón "Instalar".
 * - Si no (iOS Safari o Android sin SW), mostramos instrucciones para
 *   "Añadir a pantalla de inicio".
 *
 * Mantengamos el componente liviano: si ya está en modo standalone (la app
 * ya fue instalada y estamos abriéndola desde el icono del sistema), no se
 * renderiza nada.
 */
export function AdminInstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [iosUser, setIosUser] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStandalone(isStandalone());
    setIosUser(isIOS());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* canceló o bloqueó */
    }
    setDeferred(null);
  }, [deferred]);

  if (standalone || installed) return null;

  return (
    <div className="mt-6 rounded-xl border border-emerald-700/30 bg-emerald-950/30 px-4 py-3 text-xs leading-relaxed text-emerald-100/90">
      <p className="font-semibold text-emerald-200">Instala el panel como app</p>
      {deferred ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-emerald-100/80">
            Tendrás un icono en tu inicio que abre directamente este panel.
          </p>
          <button
            type="button"
            onClick={() => void onInstall()}
            className="min-h-9 shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 active:scale-[0.99]"
          >
            Instalar
          </button>
        </div>
      ) : iosUser ? (
        <p className="mt-2 text-emerald-100/80">
          En iPhone o iPad, toca{" "}
          <span className="font-medium text-emerald-200">Compartir</span> y elige{" "}
          <span className="font-medium text-emerald-200">
            Añadir a pantalla de inicio
          </span>
          . Abrirá este panel directamente, sin pasar por la app del cliente.
        </p>
      ) : (
        <p className="mt-2 text-emerald-100/80">
          En el menú del navegador (<span className="font-medium text-emerald-200">⋮</span>) toca{" "}
          <span className="font-medium text-emerald-200">Instalar aplicación</span> o{" "}
          <span className="font-medium text-emerald-200">Añadir a la pantalla principal</span>.
        </p>
      )}
    </div>
  );
}
