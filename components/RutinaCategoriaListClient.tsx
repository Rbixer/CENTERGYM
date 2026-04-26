"use client";

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RutinaListScreen } from "@/components/RutinaListScreen";
import type { RoutineCategoryId } from "@/lib/routine-categories";

function buildPath(pathname: string, routineId: string | null) {
  const p = new URLSearchParams();
  if (routineId) p.set("rutina", routineId);
  const q = p.toString();
  return q ? `${pathname}?${q}` : pathname;
}

function Inner({ categoryId }: { categoryId: RoutineCategoryId | null }) {
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
      categoryId={categoryId}
      focusedRoutineId={focusedRoutineId}
      onFocusedChange={onFocusedChange}
    />
  );
}

export function RutinaCategoriaListClient({
  categoryId,
}: {
  categoryId: RoutineCategoryId | null;
}) {
  return (
    <Suspense
      fallback={
        <p className="py-10 text-center text-sm text-zinc-500">Cargando rutinas…</p>
      }
    >
      <Inner categoryId={categoryId} />
    </Suspense>
  );
}
