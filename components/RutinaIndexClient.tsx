"use client";

import { Suspense } from "react";
import { RutinaCategoryPicker } from "@/components/RutinaCategoryPicker";
import { RutinaLegacyQueryRedirect } from "@/components/RutinaLegacyQueryRedirect";

function LegacySuspense() {
  return (
    <Suspense fallback={null}>
      <RutinaLegacyQueryRedirect />
    </Suspense>
  );
}

export function RutinaIndexClient() {
  return (
    <>
      <LegacySuspense />
      <RutinaCategoryPicker />
    </>
  );
}
