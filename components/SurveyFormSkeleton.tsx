/** Placeholder mientras el servidor resuelve el cuestionario (evita pantalla en blanco). */
export function SurveyFormSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-live="polite">
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Cargando…
      </p>
      <div className="space-y-3">
        <div className="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-12 w-full rounded-xl bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-100/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
          <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-600" />
          <div className="mt-3 h-5 w-full max-w-md rounded bg-zinc-200 dark:bg-zinc-600" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="h-[52px] rounded-xl bg-zinc-200 dark:bg-zinc-600" />
            <div className="h-[52px] rounded-xl bg-zinc-200 dark:bg-zinc-600" />
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-100/80 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
          <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-600" />
          <div className="mt-3 h-5 w-full max-w-sm rounded bg-zinc-200 dark:bg-zinc-600" />
          <div className="mt-4 h-[52px] w-full rounded-xl bg-zinc-200 dark:bg-zinc-600" />
        </div>
      </div>
      <div className="h-32 rounded-2xl bg-amber-100/50 dark:bg-amber-950/30" />
      <div className="h-[52px] w-full rounded-xl bg-zinc-200 dark:bg-zinc-600" />
    </div>
  );
}
