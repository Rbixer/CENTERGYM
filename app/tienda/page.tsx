import Link from "next/link";
import { Suspense } from "react";
import { GymCenterLogo } from "@/components/GymCenterLogo";
import { TiendaClient } from "@/components/TiendaClient";

export default function TiendaPage() {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-1 flex-col px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8 sm:py-12">
      <header className="mb-8 text-center">
        <div className="flex justify-center">
          <GymCenterLogo className="h-auto w-auto max-h-32 max-w-[min(100%,280px)] object-contain sm:max-h-36" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">Pedido de productos</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Elige cantidades y envía tu pedido.
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
      <Suspense fallback={<p className="py-12 text-center text-sm text-zinc-500">Cargando…</p>}>
        <TiendaClient />
      </Suspense>
    </div>
  );
}
