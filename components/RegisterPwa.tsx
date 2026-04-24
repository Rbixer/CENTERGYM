"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function scheduleIdle(fn: () => void) {
  const w = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      opts?: { timeout: number },
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(fn, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, 0);
  return () => window.clearTimeout(t);
}

/**
 * Registra el SW solo fuera de /admin. En rutas de administración lo desregistra
 * para que login y APIs no pasen por un service worker (origen de cuelgues / cookies raras).
 *
 * El registro se aplaza (idle / load) para no competir con el primer pintado y el RSC.
 */
export function RegisterPwa() {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (pathname.startsWith("/admin")) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) void r.unregister();
      });
      return;
    }

    let cancelled = false;

    const onReady = () => {
      if (cancelled) return;
      const url = `${window.location.origin}/sw.js`;
      void navigator.serviceWorker
        .register(url, { scope: "/", updateViaCache: "none" })
        .catch(() => {
          /* sin SW la web sigue funcionando */
        });
    };

    const onLoad = () => {
      if (!cancelled) onReady();
    };

    const cancelIdle = scheduleIdle(() => {
      if (cancelled) return;
      if (document.readyState === "complete") {
        onReady();
        return;
      }
      window.addEventListener("load", onLoad, { once: true });
    });

    return () => {
      cancelled = true;
      cancelIdle();
      window.removeEventListener("load", onLoad);
    };
  }, [pathname]);

  return null;
}
