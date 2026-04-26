import Link from "next/link";
import { GymCenterLogo } from "@/components/GymCenterLogo";
import { RutinaIndexClient } from "@/components/RutinaIndexClient";

export default function RutinaPage() {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-1 flex-col px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8 sm:py-12">
      <header className="mb-8 text-center">
        <div className="flex justify-center">
          <GymCenterLogo className="h-auto w-auto max-h-28 max-w-[min(100%,260px)] object-contain sm:max-h-32" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">Rutinas</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Elige un tipo: abrirá la lista de rutinas de esa zona. Y la explicación de cada una.
        </p>
        <p className="mt-3">
          <Link
            href="/"
            className="text-xs text-emerald-700 underline dark:text-emerald-400"
          >
            ← Volver al inicio
          </Link>
        </p>
      </header>
      <RutinaIndexClient />
    </div>
  );
}
