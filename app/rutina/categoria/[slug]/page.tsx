import Link from "next/link";
import { notFound } from "next/navigation";
import { GymCenterLogo } from "@/components/GymCenterLogo";
import { RutinaCategoriaListClient } from "@/components/RutinaCategoriaListClient";
import { ROUTINE_CATEGORIES, isRoutineCategoryId, routineCategoryLabel } from "@/lib/routine-categories";

type Props = { params: Promise<{ slug: string }> };

export default async function RutinaPorCategoriaPage({ params }: Props) {
  const { slug } = await params;
  if (!isRoutineCategoryId(slug)) notFound();

  const label = routineCategoryLabel(slug);
  const meta = ROUTINE_CATEGORIES.find((c) => c.id === slug);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-1 flex-col px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8 sm:py-12">
      <header className="mb-8 text-center">
        <div className="flex justify-center">
          <GymCenterLogo className="h-auto w-auto max-h-28 max-w-[min(100%,260px)] object-contain sm:max-h-32" />
        </div>
        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          Categoría
        </p>
        <h1 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">{label}</h1>
        {meta ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{meta.hint}</p>
        ) : null}
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Toca una rutina para abrir el detalle con GIF e instrucciones.
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
      <RutinaCategoriaListClient categoryId={slug} />
    </div>
  );
}
