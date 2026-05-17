"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminResultsCharts } from "@/components/AdminResultsCharts";
import { AdminRutinasPanel } from "@/components/AdminRutinasPanel";
import { AdminWorkoutsPanel } from "@/components/AdminWorkoutsPanel";
import { AdminVentasTab } from "@/components/AdminVentasTab";
import { AdminPromosPanel } from "@/components/AdminPromosPanel";
import { GymCenterLogo } from "@/components/GymCenterLogo";
import { useToast } from "@/components/ToastProvider";

type Tab = "preguntas" | "turnos" | "resultados" | "ventas" | "rutinas" | "promos";

type QuestionOption = {
  id: string;
  text: string;
  sortOrder: number;
};
type Question = {
  id: string;
  text: string;
  sortOrder: number;
  options: QuestionOption[];
};
type Trainer = { id: string; label: string; sortOrder: number };
type SubmissionRow = {
  id: string;
  submittedAt: string;
  trainerLabel: string;
  trainerRating: number | null;
  trainerComment: string | null;
  answersCount: number;
  questionCount: number;
};

type QuestionStat = {
  questionId: string;
  text: string;
  total: number;
  options: {
    optionId: string;
    text: string;
    count: number;
    percent: number;
  }[];
};

type TrainerSiNoRow = {
  trainerGroupId: string;
  label: string;
  siCount: number;
  noCount: number;
  total: number;
  siPercent: number;
  noPercent: number;
};

type TrainerStarsRow = {
  trainerGroupId: string;
  label: string;
  avgStars: number;
  count: number;
};

export function AdminPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("preguntas");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([]);
  const [trainerSiNo, setTrainerSiNo] = useState<TrainerSiNoRow[]>([]);
  const [trainerStars, setTrainerStars] = useState<TrainerStarsRow[]>([]);
  const [pie, setPie] = useState<{ label: string; value: number }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);

  const refreshQuestions = useCallback(async () => {
    const res = await fetch("/api/admin/questions", { credentials: "include" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const j = (await res.json()) as { questions?: Question[] };
    setQuestions(j.questions ?? []);
  }, [router]);

  const refreshTrainers = useCallback(async () => {
    const res = await fetch("/api/admin/trainers");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const j = (await res.json()) as { trainers?: Trainer[] };
    setTrainers(j.trainers ?? []);
  }, [router]);

  const refreshResults = useCallback(async () => {
    setResultsError(null);
    try {
      const [rSub, rStats] = await Promise.all([
        fetch("/api/admin/submissions", { credentials: "same-origin" }),
        fetch("/api/admin/stats", { credentials: "same-origin" }),
      ]);
      if (rSub.status === 401 || rStats.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!rSub.ok) {
        setResultsError("No se pudieron cargar los envíos.");
        return;
      }
      if (!rStats.ok) {
        const j = (await rStats.json().catch(() => ({}))) as {
          error?: string;
        };
        setResultsError(j.error ?? "No se pudieron cargar las estadísticas.");
        return;
      }
      const jSub = (await rSub.json()) as { submissions?: SubmissionRow[] };
      const jStats = (await rStats.json()) as {
        questionStats?: QuestionStat[];
        trainerSiNo?: TrainerSiNoRow[];
        trainerStars?: TrainerStarsRow[];
        pie?: { label: string; value: number }[];
      };
      setSubmissions(jSub.submissions ?? []);
      setQuestionStats(jStats.questionStats ?? []);
      setTrainerSiNo(jStats.trainerSiNo ?? []);
      setTrainerStars(jStats.trainerStars ?? []);
      setPie(jStats.pie ?? []);
    } catch {
      setResultsError("Error de red al cargar resultados.");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        await Promise.all([refreshQuestions(), refreshTrainers()]);
      } catch {
        if (!cancelled) setLoadError("Error al cargar datos");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshQuestions, refreshTrainers]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 min-h-[100dvh] min-[400px]:px-4 sm:px-4 sm:py-8 sm:pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex min-w-0 flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <GymCenterLogo className="max-h-20 w-auto max-w-[220px] object-contain object-left sm:max-h-24" />
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Preguntas, turnos, clientes, ventas y rutinas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Salir
          </button>
        </div>
      </header>

      <nav className="mt-6 grid w-full min-w-0 grid-cols-2 gap-1 border-b border-zinc-200 dark:border-zinc-800 sm:flex sm:flex-wrap sm:gap-2">
        {(
          [
            ["preguntas", "Preguntas", "Preguntas"],
            ["turnos", "Turno / Entrenador", "Turnos"],
            ["resultados", "Clientes", "Clientes"],
            ["ventas", "Ventas", "Ventas"],
            ["rutinas", "Rutinas", "Rutinas"],
            ["promos", "Promociones", "Promos"],
          ] as const
        ).map(([k, label, shortLabel]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              if (k !== "resultados") setResultsError(null);
              setTab(k);
              if (k === "resultados") void refreshResults();
            }}
            title={label}
            className={
              tab === k
                ? k === "rutinas"
                  ? "-mb-px border-b-2 border-violet-600 px-2 py-2 text-center text-xs font-medium text-violet-700 sm:px-3 sm:text-sm dark:text-violet-400"
                  : k === "promos"
                  ? "-mb-px border-b-2 border-amber-500 px-2 py-2 text-center text-xs font-medium text-amber-700 sm:px-3 sm:text-sm dark:text-amber-400"
                  : "-mb-px border-b-2 border-emerald-600 px-2 py-2 text-center text-xs font-medium text-emerald-700 sm:px-3 sm:text-sm dark:text-emerald-400"
                : "px-2 py-2 text-center text-xs text-zinc-500 hover:text-foreground sm:px-3 sm:text-sm"
            }
          >
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      {loadError ? (
        <p className="mt-4 text-sm text-red-600">{loadError}</p>
      ) : null}
      {tab === "resultados" && resultsError ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{resultsError}</p>
      ) : null}

      <main className="mt-8 w-full min-w-0 min-h-0 flex-1">
        {tab === "preguntas" ? (
          <QuestionsTab questions={questions} onChange={refreshQuestions} />
        ) : null}
        {tab === "turnos" ? (
          <TrainersTab trainers={trainers} onChange={refreshTrainers} />
        ) : null}
        {tab === "resultados" ? (
          <ResultsTab
            submissions={submissions}
            trainerSiNo={trainerSiNo}
            trainerStars={trainerStars}
            questionStats={questionStats}
            pie={pie}
            onRefresh={refreshResults}
          />
        ) : null}
        {tab === "ventas" ? <AdminVentasTab /> : null}
        {tab === "promos" ? <AdminPromosPanel /> : null}
        {tab === "rutinas" ? (
          <div>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              Crea rutinas con varios ejercicios (multi-selección) en la primera
              sección. La biblioteca de ejercicios individuales está al final.
              También disponible en página dedicada{" "}
              <Link
                href="/admin/rutinas"
                className="font-medium text-violet-700 underline underline-offset-2 dark:text-violet-400"
              >
                /admin/rutinas
              </Link>
              .
            </p>
            <AdminWorkoutsPanel />
            <div className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
              <header>
                <h3 className="text-base font-semibold tracking-tight">
                  Biblioteca de ejercicios
                </h3>
                <p className="mt-1 max-w-2xl text-xs text-zinc-600 dark:text-zinc-400">
                  Catálogo de movimientos individuales. Son la materia prima
                  para componer las rutinas de arriba.
                </p>
              </header>
              <div className="mt-4">
                <AdminRutinasPanel />
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function QuestionsTab({
  questions,
  onChange,
}: {
  questions: Question[];
  onChange: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-sm text-zinc-600 dark:text-zinc-400">
          Cada pregunta solo admite respuesta <strong>Sí</strong> o{" "}
          <strong>No</strong>. Escribe el enunciado y guarda.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="shrink-0 self-start rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 sm:self-center"
        >
          Nueva pregunta
        </button>
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {creating ? (
        <QuestionEditor
          mode="create"
          onCancel={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            setError(null);
            await onChange();
          }}
          onError={setError}
        />
      ) : null}
      <ul className="space-y-4">
        {questions.map((q) => (
          <QuestionRow
            key={q.id}
            question={q}
            onSaved={onChange}
            onError={setError}
          />
        ))}
      </ul>
    </div>
  );
}

function QuestionRow({
  question,
  onSaved,
  onError,
}: {
  question: Question;
  onSaved: () => Promise<void>;
  onError: (s: string | null) => void;
}) {
  const { confirm } = useToast();
  const [editing, setEditing] = useState(false);
  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      {editing ? (
        <QuestionEditor
          mode="edit"
          initial={question}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            onError(null);
            await onSaved();
          }}
          onError={onError}
        />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium text-foreground">{question.text}</p>
            <p className="mt-1 text-xs text-zinc-500">
              Respuestas fijas: <span className="font-medium">Sí</span> /{" "}
              <span className="font-medium">No</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm(
                  "¿Borrar esta pregunta? Se eliminarán también las respuestas guardadas de esa pregunta en envíos anteriores.",
                );
                if (!ok) return;
                onError(null);
                const res = await fetch(`/api/admin/questions/${question.id}`, {
                  method: "DELETE",
                });
                if (!res.ok) {
                  const j = (await res.json().catch(() => ({}))) as {
                    error?: string;
                  };
                  onError(j.error ?? "Error al borrar");
                  return;
                }
                await onSaved();
              }}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-400"
            >
              Borrar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function QuestionEditor({
  mode,
  initial,
  onCancel,
  onSaved,
  onError,
}: {
  mode: "create" | "edit";
  initial?: Question;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onError: (s: string | null) => void;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    onError(null);
    setSaving(true);
    try {
      const body = { text };
      const url =
        mode === "create"
          ? "/api/admin/questions"
          : `/api/admin/questions/${initial!.id}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        onError(j.error ?? "Error al guardar");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
      <label className="block text-sm font-medium">
        Enunciado
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
      </label>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        El alumno solo podrá responder <strong>Sí</strong> o <strong>No</strong>{" "}
        a esta pregunta.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function TrainersTab({
  trainers,
  onChange,
}: {
  trainers: Trainer[];
  onChange: () => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    const res = await fetch("/api/admin/trainers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Error");
      return;
    }
    setLabel("");
    await onChange();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Estas opciones aparecen en el desplegable obligatorio del alumno.
      </p>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej. Mañana — Entrenador Ana"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={() => void add()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
        >
          Añadir
        </button>
      </div>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
        {trainers.map((t) => (
          <TrainerRow key={t.id} trainer={t} onChange={onChange} />
        ))}
      </ul>
    </div>
  );
}

function TrainerRow({
  trainer,
  onChange,
}: {
  trainer: Trainer;
  onChange: () => Promise<void>;
}) {
  const { confirm } = useToast();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(trainer.label);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const res = await fetch(`/api/admin/trainers/${trainer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Error");
      return;
    }
    setEditing(false);
    await onChange();
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      {editing ? (
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
          {error ? (
            <span className="text-xs text-red-600">{error}</span>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setLabel(trainer.label);
                setError(null);
              }}
              className="rounded border px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className="text-sm font-medium">{trainer.label}</span>
          {error && !editing ? (
            <p className="w-full text-xs text-red-600 sm:order-last">{error}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-emerald-700 underline dark:text-emerald-400"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm(
                  "¿Borrar este turno / entrenador? Se eliminarán todos los envíos de encuesta asociados a esa opción.",
                );
                if (!ok) return;
                setError(null);
                const res = await fetch(`/api/admin/trainers/${trainer.id}`, {
                  method: "DELETE",
                });
                if (!res.ok) {
                  const j = (await res.json().catch(() => ({}))) as {
                    error?: string;
                  };
                  setError(j.error ?? "Error");
                  return;
                }
                await onChange();
              }}
              className="text-xs text-red-600 underline"
            >
              Borrar
            </button>
          </div>
        </>
      )}
    </li>
  );
}

function formatStarRow(n: number | null): string {
  if (n == null || n < 1 || n > 5) return "—";
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function ResultsTab({
  submissions,
  trainerSiNo,
  trainerStars,
  questionStats,
  pie,
  onRefresh,
}: {
  submissions: SubmissionRow[];
  trainerSiNo: TrainerSiNoRow[];
  trainerStars: TrainerStarsRow[];
  questionStats: QuestionStat[];
  pie: { label: string; value: number }[];
  onRefresh: () => Promise<void>;
}) {
  const { toast, confirm } = useToast();
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all");
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPin, setResetPin] = useState("");
  const [resetting, setResetting] = useState(false);

  async function handleResetSurveys() {
    const ok = await confirm(
      "¿Borrar TODOS los registros de encuesta? Se eliminan envíos, respuestas y códigos de recompensa ligados. Esta acción no se puede deshacer.",
    );
    if (!ok) return;
    setResetPin("");
    setResetOpen(true);
  }

  async function submitReset() {
    if (resetting) return;
    const pin = resetPin.trim();
    if (!pin) {
      toast("Escribe el PIN para continuar.", "error");
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/admin/submissions/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: { submissions?: number; promoCodes?: number };
      };
      if (res.status === 401) {
        toast("Sesión expirada. Vuelve a iniciar sesión.", "error");
        return;
      }
      if (!res.ok) {
        toast(j.error ?? "No se pudo restablecer las encuestas.", "error");
        return;
      }
      const n = j.deleted?.submissions ?? 0;
      toast(
        `Encuestas restablecidas: ${n} registro${n === 1 ? "" : "s"} eliminado${n === 1 ? "" : "s"}.`,
        "success",
      );
      setResetOpen(false);
      setResetPin("");
      await onRefresh();
    } catch {
      toast("Error de red al restablecer.", "error");
    } finally {
      setResetting(false);
    }
  }

  const filteredSubmissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (ratingFilter !== "all" && s.trainerRating !== Number(ratingFilter)) return false;
      if (commentsOnly && !s.trainerComment?.trim()) return false;
      if (!q) return true;
      return (
        s.trainerLabel.toLowerCase().includes(q) ||
        (s.trainerComment?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [commentsOnly, ratingFilter, search, submissions]);

  const summary = useMemo(() => {
    const rated = submissions.filter((s) => s.trainerRating != null);
    const ratedCount = rated.length;
    const avgStars =
      ratedCount > 0
        ? rated.reduce((acc, s) => acc + (s.trainerRating ?? 0), 0) / ratedCount
        : null;
    const withComment = submissions.filter((s) => s.trainerComment?.trim()).length;
    return {
      total: submissions.length,
      ratedCount,
      avgStars,
      withComment,
    };
  }, [submissions]);

  return (
    <div className="min-w-0 space-y-10">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-sm text-zinc-600 dark:text-zinc-400">
          Sí vs No, calificación por estrellas, comentarios, distribución por
          pregunta y clientes.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          >
            Actualizar
          </button>
          <a
            href="/api/admin/export"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
          >
            Exportar CSV
          </a>
          <button
            type="button"
            onClick={() => void handleResetSurveys()}
            disabled={summary.total === 0}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/40"
          >
            Restablecer encuestas
          </button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Total clientes</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.total}</p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Promedio estrellas</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {summary.avgStars != null ? `${summary.avgStars.toFixed(1)} / 5` : "—"}
          </p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Con valoración</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.ratedCount}</p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Con comentario</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.withComment}</p>
        </article>
      </section>

      <AdminResultsCharts
        trainerSiNo={trainerSiNo}
        trainerStars={trainerStars}
        questionStats={questionStats}
        pie={pie}
      />

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Clientes individuales</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Filtra por entrenador, comentario o calificación.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por turno o comentario..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm sm:w-64 dark:border-zinc-600 dark:bg-zinc-900"
            />
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value as typeof ratingFilter)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            >
              <option value="all">Todas las estrellas</option>
              <option value="5">5 estrellas</option>
              <option value="4">4 estrellas</option>
              <option value="3">3 estrellas</option>
              <option value="2">2 estrellas</option>
              <option value="1">1 estrella</option>
            </select>
            <label className="inline-flex select-none items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600">
              <input
                type="checkbox"
                checked={commentsOnly}
                onChange={(e) => setCommentsOnly(e.target.checked)}
                className="size-4 accent-emerald-600"
              />
              Solo comentarios
            </label>
          </div>
        </div>
        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Mostrando {filteredSubmissions.length} de {submissions.length} registros
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800/80">
              <tr>
                <th className="px-3 py-2">Fecha / hora</th>
                <th className="px-3 py-2">Turno / Entrenador</th>
                <th className="px-3 py-2">Calificación</th>
                <th className="px-3 py-2 max-w-[14rem]">Comentario</th>
                <th className="px-3 py-2">Respuestas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                    No hay clientes que coincidan con el filtro
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                    <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-300">
                      {new Date(s.submittedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{s.trainerLabel}</td>
                    <td
                      className="px-3 py-2 text-amber-600 tabular-nums dark:text-amber-400"
                      title={
                        s.trainerRating != null
                          ? `Calificación: ${s.trainerRating} de 5`
                          : undefined
                      }
                    >
                      <span className="tracking-tight">{formatStarRow(s.trainerRating)}</span>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {s.trainerComment?.trim() ? (
                        <span className="line-clamp-3 whitespace-pre-wrap break-words" title={s.trainerComment}>
                          {s.trainerComment}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-300">
                      {s.answersCount} / {s.questionCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {resetOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="survey-reset-title"
          onClick={() => {
            if (!resetting) {
              setResetOpen(false);
              setResetPin("");
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="survey-reset-title" className="text-base font-semibold text-red-800 dark:text-red-200">
              Confirmar restablecimiento
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Escribe el PIN de administrador para borrar todos los registros de encuesta.
            </p>
            <label className="mt-4 block text-sm font-medium">
              PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={resetPin}
                onChange={(e) => setResetPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitReset();
                }}
                placeholder="••••"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-lg tracking-[0.3em] dark:border-zinc-600 dark:bg-zinc-950"
                autoFocus
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={resetting}
                onClick={() => {
                  setResetOpen(false);
                  setResetPin("");
                }}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={() => void submitReset()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {resetting ? "Borrando…" : "Restablecer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
