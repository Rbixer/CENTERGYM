import Link from "next/link";
import { GymCenterLogo } from "@/components/GymCenterLogo";
import { RutinaCategoriaListClient } from "@/components/RutinaCategoriaListClient";

export default function RutinaTodasPage() {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-1 flex-col px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8 sm:py-12">
      <header className="mb-8 text-center">
        <div className="flex justify-center">
          <GymCenterLogo className="h-auto w-auto max-h-28 max-w-[min(100%,260px)] object-contain sm:max-h-32" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">Todas las rutinas</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Listado completo. Toca una fila para ver el detalle (GIF y descripción).
        </p>
        <p className="mt-3">
          <Link
            href="/rutina"
            className="text-xs text-emerald-700 underline dark:text-emerald-400"
          >
            ← Elegir otra categoría
          </Link>
        </p>
        <p className="mt-1">
          <Link
            href="/"
            className="text-xs text-zinc-500 underline dark:text-zinc-400"
          >
            ← Volver al inicio
          </Link>
        </p>
      </header>
      <RutinaCategoriaListClient categoryId={null} />
    </div>
  );
}
