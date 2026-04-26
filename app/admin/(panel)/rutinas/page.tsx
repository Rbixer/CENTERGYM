import Link from "next/link";
import { AdminRutinasPanel } from "@/components/AdminRutinasPanel";
import { GymCenterLogo } from "@/components/GymCenterLogo";

/** CRUD de rutinas (Prisma). También disponible en el panel principal, pestaña «Rutinas». */
export default function AdminRutinasPage() {
  return (
    <div className="min-h-[100dvh] w-full min-w-0 bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto w-full min-w-0 max-w-5xl px-3 min-[400px]:px-4 py-8 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/admin"
            className="text-sm font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            ← Volver al panel admin
          </Link>
          <div className="flex justify-center sm:justify-end">
            <GymCenterLogo className="h-10 w-auto object-contain sm:h-12" />
          </div>
        </div>
        <header className="mt-6 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <h1 className="text-2xl font-semibold tracking-tight">Rutinas</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Crea, edita o elimina rutinas. Los alumnos las ven en{" "}
            <Link href="/rutina" className="font-medium text-emerald-700 underline dark:text-emerald-400">
              /rutina
            </Link>
            . Con <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">OPENAI_API_KEY</code> puedes
            generar ilustraciones; si no, sube un GIF o pega una URL.
          </p>
        </header>
        <div className="mt-8">
          <AdminRutinasPanel />
        </div>
      </div>
    </div>
  );
}
