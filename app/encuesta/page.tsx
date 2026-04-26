import { Suspense } from "react";
import { GymCenterLogo } from "@/components/GymCenterLogo";
import { SurveyForm } from "@/components/SurveyForm";
import { SurveyFormSkeleton } from "@/components/SurveyFormSkeleton";
import { getPublicQuestionnaire } from "@/lib/public-questionnaire";
import Link from "next/link";

async function SurveyWithData() {
  const questionnaire = await getPublicQuestionnaire();
  return <SurveyForm initialQuestionnaire={questionnaire} />;
}

export default function EncuestaPage() {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-1 flex-col px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8 sm:py-12">
      <header className="mb-10 text-center">
        <div className="flex justify-center">
          <GymCenterLogo className="h-auto w-auto max-h-36 max-w-[min(100%,320px)] object-contain sm:max-h-40" />
        </div>
        <p className="mt-4 text-base font-medium leading-relaxed text-zinc-700 sm:text-lg dark:text-zinc-300">
          Califica a tu entrenador y servicios del gym de forma anónima.
        </p>
        <p className="pwa-install-hint mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
          En el móvil puedes instalar esta página: menú del navegador →{" "}
          <span className="whitespace-nowrap">«Añadir a pantalla de inicio»</span>{" "}
          o «Instalar app».
        </p>
        <p className="mt-4">
          <Link
            href="/"
            className="text-xs text-emerald-700 underline dark:text-emerald-400"
          >
            ← Volver al inicio
          </Link>
        </p>
      </header>
      <Suspense fallback={<SurveyFormSkeleton />}>
        <SurveyWithData />
      </Suspense>
    </div>
  );
}
