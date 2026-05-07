"use client";

import type {
  PublicQuestion,
  PublicTrainer,
} from "@/lib/public-questionnaire-types";
import {
  classifyYesNoOption,
  isYesNoPair,
  orderYesNoOptions,
} from "@/lib/yes-no";
import { useEffect, useMemo, useState } from "react";

type Questionnaire = {
  trainers: PublicTrainer[];
  questions: PublicQuestion[];
};

type Props = {
  /** Si viene de la página (RSC), evita un fetch extra y compila menos en `next dev`. */
  initialQuestionnaire?: Questionnaire;
  /** Token firmado emitido por el server al renderizar /encuesta (anti-bot). */
  formToken?: string;
};

function generateRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function SurveyForm({ initialQuestionnaire, formToken }: Props) {
  const hydrateFromServer = initialQuestionnaire != null;

  const [trainers, setTrainers] = useState<PublicTrainer[]>(
    () => initialQuestionnaire?.trainers ?? [],
  );
  const [questions, setQuestions] = useState<PublicQuestion[]>(
    () => initialQuestionnaire?.questions ?? [],
  );
  const [trainerId, setTrainerId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [trainerRating, setTrainerRating] = useState<number | null>(null);
  const [trainerComment, setTrainerComment] = useState("");
  // Honeypot: campo invisible que los humanos no rellenan.
  const [hpUrl, setHpUrl] = useState("");
  // Mismo `requestId` durante toda la vida del componente: si el usuario hace
  // doble click o reenvía por error, el server devuelve el envío previo.
  const [requestId] = useState<string>(() => generateRequestId());
  const [loading, setLoading] = useState(!hydrateFromServer);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ submittedAt: string } | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);

  useEffect(() => {
    if (hydrateFromServer) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/public/questionnaire");
        const j = (await res.json()) as {
          trainers?: PublicTrainer[];
          questions?: PublicQuestion[];
        };
        if (!res.ok) throw new Error("No se pudo cargar el cuestionario");
        if (!cancelled) {
          setTrainers(j.trainers ?? []);
          setQuestions(j.questions ?? []);
        }
      } catch {
        if (!cancelled) setError("Error de red al cargar el cuestionario.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateFromServer]);

  const trainerOptions = useMemo(
    () =>
      trainers.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      )),
    [trainers],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!trainerId) {
      setError("Selecciona Turno / Entrenador.");
      return;
    }
    if (trainerRating === null || trainerRating < 1 || trainerRating > 5) {
      setError("Valora al entrenador o turno con las estrellas (1 a 5).");
      return;
    }
    if (trainerComment.length > 2000) {
      setError("El comentario no puede superar 2000 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainerGroupId: trainerId,
          answers,
          trainerRating,
          trainerComment: trainerComment.trim() || undefined,
          requestId,
          formToken,
          hpUrl,
        }),
      });
      const raw = await res.text();
      let j: { error?: string; submittedAt?: string } = {};
      if (raw) {
        try {
          j = JSON.parse(raw) as typeof j;
        } catch {
          setError(
            res.ok
              ? "Respuesta del servidor no válida."
              : `Error del servidor (${res.status}). Prueba a recargar o reiniciar la app.`,
          );
          return;
        }
      }
      if (res.status === 409) {
        setAlreadyDone(true);
        return;
      }
      if (res.status === 429) {
        setError(
          j.error ??
            "Has enviado varias encuestas seguidas desde esta red. Intenta de nuevo más tarde.",
        );
        return;
      }
      if (!res.ok) {
        setError(j.error ?? `No se pudo enviar (${res.status}).`);
        return;
      }
      setDone({
        submittedAt: j.submittedAt ?? new Date().toISOString(),
      });
    } catch {
      setError(
        "No hay conexión con el servidor. Comprueba la red o que el servicio esté en marcha.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <p className="flex min-h-[44px] items-center justify-center text-center text-base text-zinc-500 dark:text-zinc-400">
        Cargando…
      </p>
    );
  }

  if (alreadyDone) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="text-lg font-medium text-emerald-900 dark:text-emerald-100">
          Ya respondiste la encuesta desde este dispositivo
        </p>
        <p className="mt-3 text-sm text-emerald-800/90 dark:text-emerald-200/85">
          Gracias por tu opinión. Para mantener resultados representativos, cada
          persona puede enviar la encuesta una sola vez por mes.
        </p>
      </div>
    );
  }

  if (done) {
    const when = new Date(done.submittedAt);
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="text-lg font-medium text-emerald-900 dark:text-emerald-100">
          Respuestas registradas
        </p>
        <p className="mt-3 text-sm text-emerald-800/90 dark:text-emerald-200/85">
          Gracias por completar el cuestionario y por valorar a tu entrenador o
          turno.
        </p>
        <p className="mt-4 text-xs text-emerald-900/70 dark:text-emerald-200/60">
          Fecha y hora del envío:{" "}
          {when.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        Aún no hay preguntas. Un administrador debe configurarlas en el panel.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Honeypot anti-bot: invisible para humanos (off-screen + aria-hidden + tabIndex=-1).
          Si llega con valor, el endpoint trata el envío como spam y lo descarta. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label>
          Sitio web (no rellenar)
          <input
            type="text"
            name="website"
            value={hpUrl}
            onChange={(e) => setHpUrl(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">
          Turno / Entrenador <span className="text-red-600">*</span>
        </label>
        <select
          required
          value={trainerId}
          onChange={(e) => setTrainerId(e.target.value)}
          className="mt-2 min-h-[48px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base text-foreground shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 dark:border-zinc-600 dark:bg-zinc-900"
        >
          <option value="">— Selecciona —</option>
          {trainerOptions}
        </select>
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => {
          const opts = orderYesNoOptions(q.options);
          const yesNo = isYesNoPair(opts);
          return (
            <fieldset
              key={q.id}
              className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-900/40"
            >
              <legend className="px-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Pregunta {idx + 1}
              </legend>
              <p className="mt-1 text-base font-medium text-foreground">{q.text}</p>
              {yesNo ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {opts.map((o) => {
                    const isSi = classifyYesNoOption(o.text) === "si";
                    const selected = answers[q.id] === o.id;
                    return (
                      <label
                        key={o.id}
                        className={
                          selected
                            ? isSi
                              ? "flex min-h-[52px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-emerald-600 bg-emerald-50 px-3 py-3 text-center dark:bg-emerald-950/50"
                              : "flex min-h-[52px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-slate-500 bg-slate-100 px-3 py-3 text-center dark:bg-slate-800/80"
                            : "flex min-h-[52px] cursor-pointer flex-col items-center justify-center rounded-xl border border-zinc-300 bg-white/80 px-3 py-3 text-center active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900/60 dark:active:bg-zinc-800"
                        }
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={o.id}
                          required
                          checked={selected}
                          onChange={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: o.id }))
                          }
                          className="sr-only"
                        />
                        <span
                          className={
                            isSi
                              ? "text-lg font-semibold text-emerald-800 dark:text-emerald-200"
                              : "text-lg font-semibold text-slate-700 dark:text-slate-200"
                          }
                        >
                          {o.text}
                        </span>
                        <span className="mt-0.5 text-[11px] text-zinc-500">
                          {isSi ? "Respuesta positiva" : "Respuesta negativa"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {opts.map((o) => (
                    <label
                      key={o.id}
                      className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-zinc-200/80 bg-white/50 px-3 py-3 active:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:active:bg-zinc-800"
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={o.id}
                        required
                        checked={answers[q.id] === o.id}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: o.id }))
                        }
                        className="size-5 shrink-0 accent-emerald-600"
                      />
                      <span className="text-base leading-snug text-foreground">
                        {o.text}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>

      <fieldset className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
        <legend className="px-1 text-sm font-medium text-amber-900 dark:text-amber-200">
          Calificación del entrenador / turno
        </legend>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          Las estrellas son la <strong className="font-semibold">calificación</strong>{" "}
          (1 a 5) que recibe el entrenador o turno que elegiste. El promedio de
          todas las encuestas será su nota global en resultados.
        </p>
        <div
          className="mt-4 flex flex-wrap items-center justify-center gap-1 sm:gap-2"
          role="group"
          aria-label="Valoración de 1 a 5 estrellas"
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const active = trainerRating !== null && n <= trainerRating;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setTrainerRating(n)}
                aria-pressed={active}
                aria-label={`${n} estrella${n > 1 ? "s" : ""} de 5`}
                className={
                  active
                    ? "min-h-[48px] min-w-[48px] rounded-xl text-3xl text-amber-500 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    : "min-h-[48px] min-w-[48px] rounded-xl text-3xl text-zinc-300 transition hover:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/60 dark:text-zinc-600"
                }
              >
                ★
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-zinc-600 dark:text-zinc-400">
          {trainerRating === null
            ? "Toca las estrellas (obligatorio)."
            : `${trainerRating} de 5 estrellas`}
        </p>

        <label className="mt-6 block text-sm font-medium text-amber-950 dark:text-amber-100">
          Comentario (opcional)
          <textarea
            value={trainerComment}
            onChange={(e) => setTrainerComment(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Escribe aquí tu opinión sobre el entrenador o el turno…"
            className="mt-2 w-full resize-y rounded-xl border border-amber-200/90 bg-white px-3 py-3 text-base text-foreground shadow-sm outline-none placeholder:text-zinc-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-500 dark:border-amber-900/60 dark:bg-zinc-900"
          />
        </label>
        <p className="mt-1 text-right text-xs text-zinc-500">
          {trainerComment.length} / 2000
        </p>
      </fieldset>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-[52px] w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white shadow transition active:bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60"
      >
        {submitting ? "Enviando…" : "Enviar respuestas"}
      </button>
    </form>
  );
}
