import Link from "next/link";
import { GymCenterLogo } from "@/components/GymCenterLogo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Cuenta cuántos códigos públicos están activos AHORA para decidir si mostrar
 * el botón «Promos» con badge. Si la BD falla, ocultamos el botón sin romper
 * la home (es solo decorativo).
 */
async function countActivePublicPromos(): Promise<number> {
  try {
    const now = new Date();
    const rows = await prisma.promoCode.findMany({
      where: {
        isPublic: true,
        active: true,
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: now } }] }],
      },
      select: { maxUses: true, uses: true },
    });
    return rows.filter((r) => r.maxUses == null || r.uses < r.maxUses).length;
  } catch {
    return 0;
  }
}

export default async function PortalPage() {
  const promoCount = await countActivePublicPromos();
  const hasPromos = promoCount > 0;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-1 flex-col px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-10 sm:py-14">
      <header className="text-center">
        <div className="flex justify-center">
          <GymCenterLogo className="h-auto w-auto max-h-32 max-w-[min(100%,280px)] object-contain sm:max-h-36" />
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          ¿Qué deseas hacer?
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Encuesta, tienda{hasPromos ? ", promociones" : ""} o rutinas de ejemplo.
        </p>
      </header>

      {hasPromos ? (
        <Link
          href="/promos"
          className="group relative mt-8 flex items-center gap-3 overflow-hidden rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 px-5 py-4 shadow-md transition hover:border-amber-500 hover:shadow-lg active:scale-[0.99] dark:border-amber-600 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-amber-950/40"
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-300/40 blur-2xl" />
          <span className="relative text-2xl">🏷️</span>
          <div className="relative min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
              ¡{promoCount} promoción{promoCount === 1 ? "" : "es"} activa
              {promoCount === 1 ? "" : "s"}!
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
              Toca para ver y copiar los códigos
            </p>
          </div>
          <span className="relative text-lg font-bold text-amber-900 dark:text-amber-100">→</span>
        </Link>
      ) : null}

      <nav className="mt-10 grid flex-1 grid-cols-1 content-center gap-4 sm:mt-12 sm:grid-cols-3">
        <Link
          href="/encuesta"
          className="group flex min-h-[3.5rem] flex-col items-center justify-center rounded-2xl border-2 border-emerald-500/40 bg-emerald-600 px-5 py-7 text-center text-lg font-semibold text-white shadow-md transition hover:border-emerald-400 hover:bg-emerald-500 hover:shadow-lg active:scale-[0.99] sm:min-h-[5rem] sm:py-8 sm:text-xl"
        >
          Encuesta
        </Link>
        <Link
          href="/tienda"
          className="group flex min-h-[3.5rem] flex-col items-center justify-center rounded-2xl border-2 border-zinc-300 bg-zinc-900 px-5 py-7 text-center text-lg font-semibold text-white shadow-md transition hover:border-zinc-400 hover:bg-zinc-800 hover:shadow-lg active:scale-[0.99] dark:border-zinc-600 dark:bg-zinc-950 dark:hover:bg-zinc-900 sm:min-h-[5rem] sm:py-8 sm:text-xl"
        >
          Tienda
        </Link>
        <Link
          href="/rutina"
          className="group flex min-h-[3.5rem] flex-col items-center justify-center rounded-2xl border-2 border-violet-400/50 bg-violet-600 px-5 py-7 text-center text-lg font-semibold text-white shadow-md transition hover:border-violet-300 hover:bg-violet-500 hover:shadow-lg active:scale-[0.99] sm:min-h-[5rem] sm:py-8 sm:text-xl"
        >
          Rutina
        </Link>
      </nav>

      <p className="pwa-install-hint mt-auto pt-8 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
        En el móvil puedes instalar la app: menú del navegador →{" "}
        <span className="whitespace-nowrap">«Añadir a pantalla de inicio»</span> o
        «Instalar app».
      </p>
    </div>
  );
}
