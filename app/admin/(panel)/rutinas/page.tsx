import Link from "next/link";
import { AdminRutinasPanel } from "@/components/AdminRutinasPanel";
import { AdminWorkoutsPanel } from "@/components/AdminWorkoutsPanel";
import { GymCenterLogo } from "@/components/GymCenterLogo";

/**
 * Página unificada de rutinas para el admin.
 *
 * Tiene dos secciones, en este orden (de lo más visible a lo más operativo):
 * 1. «Mis rutinas (sesiones)» — `AdminWorkoutsPanel`: crea rutinas con varios
 *    ejercicios, cada uno con sus series y repeticiones. Esto es lo que los
 *    alumnos ven en `/rutina/categoria/<slug>`.
 * 2. «Biblioteca de ejercicios» — `AdminRutinasPanel`: catálogo de
 *    movimientos individuales (nombre, GIF, descripción, zona). Es la fuente
 *    desde la que se eligen ejercicios para componer las rutinas.
 */
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
            Crea rutinas con varios ejercicios y sus series/repeticiones. Los alumnos las ven en{" "}
            <Link href="/rutina" className="font-medium text-emerald-700 underline dark:text-emerald-400">
              /rutina
            </Link>
            . Si te falta algún ejercicio, créalo en la biblioteca de abajo (puedes subir GIFs en
            lote desde tu carpeta de descargas).
          </p>
        </header>

        <div className="mt-8">
          <AdminWorkoutsPanel />
        </div>

        <div className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <header>
            <h2 className="text-xl font-semibold tracking-tight">
              Biblioteca de ejercicios
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Catálogo de movimientos individuales con su GIF y zona. Son la materia prima para
              componer las rutinas de arriba; no aparecen directamente al alumno fuera de una
              rutina.
            </p>
          </header>
          <div className="mt-6">
            <AdminRutinasPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
