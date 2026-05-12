"use client";

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RutinaLegacyQueryRedirect } from "@/components/RutinaLegacyQueryRedirect";
import { RutinaListScreen } from "@/components/RutinaListScreen";

function LegacySuspense() {
  return (
    <Suspense fallback={null}>
      <RutinaLegacyQueryRedirect />
    </Suspense>
  );
}

function buildPath(pathname: string, routineId: string | null) {
  const p = new URLSearchParams();
  if (routineId) p.set("rutina", routineId);
  const q = p.toString();
  return q ? `${pathname}?${q}` : pathname;
}

/**
 * Pantalla principal de rutinas para el alumno (`/rutina`).
 *
 * Antes mostraba un selector de categorías y luego derivaba a otra página.
 * Ahora el modelo es distinto: una rutina ya es una sesión completa con
 * varios ejercicios. Las sesiones suelen ser pocas y mixtas (ej. "Empuje
 * día 1" toca pecho + hombros + tríceps), así que filtrar por una sola
 * zona deja la mayoría de rutinas fuera del listado. Mostramos directamente
 * todas las rutinas publicadas — el alumno toca una y ve su detalle.
 *
 * Las páginas `/rutina/categoria/<slug>` y `/rutina/todas` siguen
 * existiendo para enlaces guardados; este componente envuelve la misma
 * `RutinaListScreen` con `categoryId={null}` y se encarga del query
 * `?rutina=<id>` para enfocar una rutina concreta al volver desde un share.
 */
function Inner() {
  const router = useRouter();
  const pathname = usePathname() ?? "/rutina";
  const searchParams = useSearchParams();
  const focusedRoutineId = searchParams.get("rutina")?.trim() || null;

  const onFocusedChange = useCallback(
    (id: string | null) => {
      const next = buildPath(pathname, id);
      if (id) {
        router.push(next, { scroll: true });
      } else {
        router.replace(next, { scroll: true });
      }
    },
    [router, pathname],
  );

  return (
    <RutinaListScreen
      categoryId={null}
      focusedRoutineId={focusedRoutineId}
      onFocusedChange={onFocusedChange}
    />
  );
}

export function RutinaIndexClient() {
  return (
    <>
      <LegacySuspense />
      <Suspense
        fallback={
          <p className="py-10 text-center text-sm text-zinc-500">
            Cargando rutinas…
          </p>
        }
      >
        <Inner />
      </Suspense>
    </>
  );
}
