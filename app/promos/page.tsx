import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatGtq } from "@/lib/money";
import { GymCenterLogo } from "@/components/GymCenterLogo";
import { PromoCodeCard } from "@/components/PromoCodeCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PublicPromo = {
  code: string;
  kind: string;
  discountType: string;
  discountValue: number;
  minSubtotalCents: number | null;
  usesLeft: number | null;
  validUntil: string | null;
};

async function loadPublicPromos(): Promise<PublicPromo[]> {
  try {
    const now = new Date();
    const rows = await prisma.promoCode.findMany({
      where: {
        isPublic: true,
        active: true,
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: now } }] }],
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        code: true,
        kind: true,
        discountType: true,
        discountValue: true,
        minSubtotalCents: true,
        maxUses: true,
        uses: true,
        validUntil: true,
      },
    });
    return rows
      .filter((r) => r.maxUses == null || r.uses < r.maxUses)
      .map((r) => ({
        code: r.code,
        kind: r.kind,
        discountType: r.discountType,
        discountValue: r.discountValue,
        minSubtotalCents: r.minSubtotalCents,
        usesLeft: r.maxUses != null ? Math.max(0, r.maxUses - r.uses) : null,
        validUntil: r.validUntil?.toISOString() ?? null,
      }));
  } catch {
    return [];
  }
}

export default async function PromosPage() {
  const promos = await loadPublicPromos();

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-1 flex-col px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8 sm:py-12">
      <header className="mb-8 text-center">
        <div className="flex justify-center">
          <GymCenterLogo className="h-auto w-auto max-h-32 max-w-[min(100%,280px)] object-contain sm:max-h-36" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
          Promociones disponibles
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Toca el código para copiarlo y úsalo al pagar en la tienda.
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

      {promos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-base font-medium text-foreground">
            No hay promociones activas
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Vuelve pronto. También recibes un código personal al{" "}
            <Link
              href="/encuesta"
              className="font-medium text-emerald-700 underline dark:text-emerald-400"
            >
              completar la encuesta
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {promos.map((p) => (
            <PromoCodeCard
              key={p.code}
              code={p.code}
              discountType={p.discountType}
              discountValue={p.discountValue}
              minSubtotalLabel={
                p.minSubtotalCents ? formatGtq(p.minSubtotalCents) : null
              }
              validUntil={p.validUntil}
              usesLeft={p.usesLeft}
            />
          ))}
        </ul>
      )}

      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-center text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        ¿Quieres un código personal? Completa la{" "}
        <Link
          href="/encuesta"
          className="font-semibold underline underline-offset-2"
        >
          encuesta de los entrenadores
        </Link>{" "}
        y te llega uno único al terminar.
      </div>
    </div>
  );
}
