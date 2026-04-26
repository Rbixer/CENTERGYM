"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isRoutineCategoryId } from "@/lib/routine-categories";

/** Compat: /rutina?categoria=&rutina= → nuevas rutas bajo /rutina/categoria/ o /rutina/todas */
export function RutinaLegacyQueryRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    const cat = searchParams.get("categoria");
    const rid = searchParams.get("rutina")?.trim() ?? "";
    if (cat && isRoutineCategoryId(cat)) {
      didRun.current = true;
      const q = rid ? `?rutina=${encodeURIComponent(rid)}` : "";
      router.replace(`/rutina/categoria/${cat}${q}`);
      return;
    }
    if (rid) {
      didRun.current = true;
      router.replace(`/rutina/todas?rutina=${encodeURIComponent(rid)}`);
    }
  }, [searchParams, router]);

  return null;
}
