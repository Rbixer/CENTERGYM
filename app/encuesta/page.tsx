import { Suspense } from "react";
import { cookies } from "next/headers";
import { GymCenterLogo } from "@/components/GymCenterLogo";
import { SurveyForm } from "@/components/SurveyForm";
import { SurveyFormSkeleton } from "@/components/SurveyFormSkeleton";
import { getPublicQuestionnaire } from "@/lib/public-questionnaire";
import {
  SURVEY_DONE_COOKIE,
  verifySurveyDoneToken,
} from "@/lib/survey-cookie";
import { createSurveyFormToken } from "@/lib/survey-form-token";
import Link from "next/link";

function SurveyAlreadyDone() {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
      <p className="text-lg font-medium text-emerald-900 dark:text-emerald-100">
        Ya respondiste la encuesta desde este dispositivo
      </p>
      <p className="mt-3 text-sm text-emerald-800/90 dark:text-emerald-200/85">
        Gracias por tu opinión. Para mantener resultados representativos, cada
        persona puede enviar la encuesta una sola vez por mes.
      </p>
      <p className="mt-4 text-xs text-emerald-900/70 dark:text-emerald-200/60">
        Si no fuiste tú quien respondió, vuelve a intentarlo más tarde.
      </p>
    </div>
  );
}

async function SurveyWithData() {
  const cookieStore = await cookies();
  const doneCookie = cookieStore.get(SURVEY_DONE_COOKIE)?.value;
  if (verifySurveyDoneToken(doneCookie)) {
    return <SurveyAlreadyDone />;
  }

  const questionnaire = await getPublicQuestionnaire();
  const formToken = createSurveyFormToken();
  return (
    <SurveyForm
      initialQuestionnaire={questionnaire}
      formToken={formToken}
    />
  );
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
