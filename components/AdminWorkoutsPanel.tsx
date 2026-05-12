"use client";

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { parseResponseJson } from "@/lib/parse-response-json";
import {
  ROUTINE_CATEGORIES,
  DEFAULT_ROUTINE_CATEGORY,
  normalizeRoutineCategory,
  routineCategoryLabel,
  type RoutineCategoryId,
} from "@/lib/routine-categories";
import { EQUIPMENTS, equipmentLabel } from "@/lib/equipment";
import {
  MAX_REPS_LEN,
  MAX_SETS,
  MIN_SETS,
  MAX_WORKOUT_DESC_LEN,
  MAX_WORKOUT_NAME_LEN,
  MAX_NOTES_LEN,
  MAX_WORKOUT_ITEMS,
} from "@/lib/workout-validation";
import { useToast } from "@/components/ToastProvider";

const ROUTINE_FALLBACK_SRC = "/images/routines/placeholder.gif";

function withRoutineFallback(ev: SyntheticEvent<HTMLImageElement>) {
  const img = ev.currentTarget;
  if (img.dataset.fallbackApplied === "1") return;
  img.dataset.fallbackApplied = "1";
  img.src = ROUTINE_FALLBACK_SRC;
}

/** Forma de un ejercicio de la biblioteca (modelo `Routine` en BD). */
type ExerciseRow = {
  id: string;
  name: string;
  description: string;
  gifUrl: string;
  /** Thumbnail JPG ligero (~10KB). Si está disponible, lo usamos en grids. */
  thumbUrl?: string | null;
  category: string;
  /** Slug de equipamiento ("dumbbell", "barbell"…). Null si no se conoce. */
  equipment?: string | null;
};

/** Ítem de una rutina-sesión tal como lo devuelve `/api/admin/workouts`. */
type WorkoutItem = {
  id: string;
  sets: number;
  reps: string;
  restSec: number | null;
  notes: string | null;
  exercise: ExerciseRow;
};

/** Función helper: prefiere thumb sobre gif para listados/grids. */
function previewSrc(ex: { gifUrl: string; thumbUrl?: string | null }): string {
  return ex.thumbUrl || ex.gifUrl;
}

/**
 * Plantillas de esquema series×repeticiones para rellenar de un toque. Cada
 * plantilla define los `defaults` que se aplicarán a:
 *   a) cada ejercicio recién añadido al draft,
 *   b) opcionalmente, todos los ejercicios ya añadidos (con el botón
 *      "aplicar a todos" en la barra de plantillas).
 *
 * El esquema cubre los protocolos más usados en una sala (fuerza máxima,
 * hipertrofia, resistencia, HIIT, movilidad). El admin puede seguir editando
 * cada ejercicio individualmente después.
 */
type RoutineTemplateId =
  | "strength"
  | "hypertrophy"
  | "endurance"
  | "hiit"
  | "mobility"
  | "custom";

type RoutineTemplate = {
  id: RoutineTemplateId;
  label: string;
  icon: string;
  short: string;
  sets: number;
  reps: string;
  restSec: number;
};

const ROUTINE_TEMPLATES: readonly RoutineTemplate[] = [
  { id: "strength", label: "Fuerza", icon: "💪", short: "5 × 5", sets: 5, reps: "5", restSec: 120 },
  { id: "hypertrophy", label: "Hipertrofia", icon: "🏋️", short: "4 × 12", sets: 4, reps: "12", restSec: 60 },
  { id: "endurance", label: "Resistencia", icon: "🏃", short: "3 × 15", sets: 3, reps: "15", restSec: 45 },
  { id: "hiit", label: "HIIT", icon: "⚡", short: "4 × 30s", sets: 4, reps: "30 seg", restSec: 30 },
  { id: "mobility", label: "Movilidad", icon: "🧘", short: "2 × 10", sets: 2, reps: "10 c/u", restSec: 30 },
  { id: "custom", label: "Personalizado", icon: "✏️", short: "—", sets: 4, reps: "12", restSec: 60 },
];

function templateById(id: RoutineTemplateId): RoutineTemplate {
  return ROUTINE_TEMPLATES.find((t) => t.id === id) ?? ROUTINE_TEMPLATES[1]!;
}

/**
 * Duración estimada de la rutina en minutos: suma series × (tiempo_ejecución
 * + descanso). Asumimos ~30s por serie de ejecución por defecto (peor caso
 * razonable). Es solo informativo para que el admin tenga una idea.
 */
function estimateDurationMin(items: { sets: number; restSec: string }[]): number {
  let totalSec = 0;
  for (const it of items) {
    const rest = Number(it.restSec) || 60;
    const setSec = 30;
    totalSec += it.sets * (setSec + rest);
  }
  return Math.max(1, Math.round(totalSec / 60));
}

type Workout = {
  id: string;
  name: string;
  description: string;
  category: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  items: WorkoutItem[];
};

/** Estado local de un ítem en edición (sin id porque puede ser nuevo). */
type DraftItem = {
  exerciseId: string;
  exerciseName: string;
  exerciseGifUrl: string;
  /** Preview ligero usado en la lista del editor. */
  exerciseThumbUrl?: string | null;
  exerciseCategory: string;
  sets: number;
  reps: string;
  restSec: string;
  notes: string;
};

function emptyDraftItem(ex: ExerciseRow, template?: RoutineTemplate): DraftItem {
  const t = template ?? templateById("hypertrophy");
  return {
    exerciseId: ex.id,
    exerciseName: ex.name,
    exerciseGifUrl: ex.gifUrl,
    exerciseThumbUrl: ex.thumbUrl ?? null,
    exerciseCategory: ex.category,
    sets: t.sets,
    reps: t.reps,
    restSec: String(t.restSec),
    notes: "",
  };
}

function itemFromServer(it: WorkoutItem): DraftItem {
  return {
    exerciseId: it.exercise.id,
    exerciseName: it.exercise.name,
    exerciseGifUrl: it.exercise.gifUrl,
    exerciseThumbUrl: it.exercise.thumbUrl ?? null,
    exerciseCategory: it.exercise.category,
    sets: it.sets,
    reps: it.reps,
    restSec: it.restSec != null ? String(it.restSec) : "",
    notes: it.notes ?? "",
  };
}

/**
 * Panel para crear, editar y borrar Rutinas-sesión (modelo `Workout` en BD).
 * Una rutina = nombre + categoría + N ejercicios encadenados, cada uno con
 * sus series y repeticiones. Se renderiza encima de la biblioteca de
 * ejercicios en `/admin/rutinas` para que el flujo natural sea:
 *   1) Subir GIFs (biblioteca abajo).
 *   2) Crear ejercicios desde GIFs.
 *   3) Componer rutinas usando esos ejercicios (este panel).
 */
export function AdminWorkoutsPanel() {
  const router = useRouter();
  const { toast, confirm } = useToast();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [library, setLibrary] = useState<ExerciseRow[]>([]);
  const [loadingLib, setLoadingLib] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RoutineCategoryId>(
    DEFAULT_ROUTINE_CATEGORY,
  );
  const [items, setItems] = useState<DraftItem[]>([]);
  /** Esquema activo (define defaults para nuevos ejercicios y bulk-apply). */
  const [templateId, setTemplateId] = useState<RoutineTemplateId>("hypertrophy");
  /** Qué ejercicio está mostrando el acordeón "Más opciones" (-1 = ninguno). */
  const [expandedItemIdx, setExpandedItemIdx] = useState<number>(-1);
  const [saving, setSaving] = useState(false);

  // Selector de ejercicios (modal inline). Soporta multiselección: el admin
  // marca varios checkboxes y pulsa "Añadir N" para incorporarlos de golpe.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<RoutineCategoryId | "all">(
    "all",
  );
  const [pickerEquipment, setPickerEquipment] = useState<string>("all");
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Set<string>>(
    () => new Set<string>(),
  );

  // Drag & drop: índice del item que se está arrastrando.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    setSetupHint(null);
    const res = await fetch("/api/admin/workouts", { credentials: "include" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const p = await parseResponseJson<{
      workouts?: Workout[];
      error?: string;
      setupRequired?: boolean;
      setupHint?: string;
    }>(res);
    if (p.parseError || !p.body) {
      setLoadError(p.parseError ?? "No se pudo leer la respuesta del servidor.");
      setWorkouts([]);
      return;
    }
    if (p.body.setupRequired) {
      setSetupHint(p.body.setupHint ?? null);
      setWorkouts([]);
      return;
    }
    if (!p.ok) {
      setLoadError(p.body.error ?? "Error al listar rutinas.");
      setWorkouts([]);
      return;
    }
    setWorkouts(p.body.workouts ?? []);
  }, [router]);

  const refreshLibrary = useCallback(async () => {
    setLoadingLib(true);
    try {
      const res = await fetch("/api/admin/routines", {
        credentials: "include",
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const p = await parseResponseJson<{
        routines?: ExerciseRow[];
        setupRequired?: boolean;
      }>(res);
      if (p.parseError || !p.body || !p.ok) {
        setLibrary([]);
        return;
      }
      setLibrary(p.body.routines ?? []);
    } finally {
      setLoadingLib(false);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
    void refreshLibrary();
  }, [refresh, refreshLibrary]);

  function resetEditor() {
    setEditingId(null);
    setName("");
    setNameTouched(false);
    setDescription("");
    setCategory(DEFAULT_ROUTINE_CATEGORY);
    setItems([]);
    setTemplateId("hypertrophy");
    setExpandedItemIdx(-1);
  }

  function startEdit(w: Workout) {
    setEditingId(w.id);
    setName(w.name);
    setNameTouched(true);
    setDescription(w.description);
    setCategory(normalizeRoutineCategory(w.category));
    setItems(w.items.map(itemFromServer));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function togglePickerSelection(id: string) {
    setPickerSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelectedExercisesToDraft() {
    if (pickerSelectedIds.size === 0) {
      toast("Marca al menos un ejercicio.", "error");
      return;
    }
    setItems((prev) => {
      const slotsLeft = MAX_WORKOUT_ITEMS - prev.length;
      if (slotsLeft <= 0) {
        toast(`Máximo ${MAX_WORKOUT_ITEMS} ejercicios por rutina.`, "error");
        return prev;
      }
      // Conserva el orden en que aparecen en la biblioteca (categoría/nombre).
      const ordered = library.filter((ex) => pickerSelectedIds.has(ex.id));
      const template = templateById(templateId);
      const toAdd = ordered.slice(0, slotsLeft).map((ex) => emptyDraftItem(ex, template));
      if (ordered.length > slotsLeft) {
        toast(
          `Se añadieron ${slotsLeft} de ${ordered.length}: máximo ${MAX_WORKOUT_ITEMS} ejercicios por rutina.`,
          "info",
        );
      } else {
        toast(
          `${toAdd.length} ejercicio${toAdd.length === 1 ? "" : "s"} añadido${toAdd.length === 1 ? "" : "s"}.`,
          "success",
        );
      }
      return [...prev, ...toAdd];
    });
    setPickerSelectedIds(new Set());
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  /**
   * Aplica el esquema (sets/reps/restSec) a TODOS los ejercicios del draft.
   * Se llama al pulsar un chip de plantilla cuando ya hay items en la rutina.
   */
  function applyTemplateToAll(t: RoutineTemplate) {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        sets: t.sets,
        reps: t.reps,
        restSec: String(t.restSec),
      })),
    );
    toast(
      `Aplicado «${t.label} ${t.short}» a ${items.length} ejercicio${items.length === 1 ? "" : "s"}.`,
      "success",
    );
  }

  /**
   * Sugiere un nombre tipo "Pecho — día 3" si el admin no ha escrito uno
   * propio. Se basa en cuántas rutinas existen YA en esa categoría: así no
   * pisa numeraciones existentes. Se llama cuando cambia la categoría o
   * cuando se añaden los primeros ejercicios.
   */
  function suggestNameFor(cat: RoutineCategoryId): string {
    if (workouts == null) return "";
    const sameCat = workouts.filter(
      (w) => normalizeRoutineCategory(w.category) === cat,
    );
    const dayNumber = sameCat.length + 1;
    return `${routineCategoryLabel(cat)} — día ${dayNumber}`;
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveItem(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = prev.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const [moved] = next.splice(idx, 1);
      next.splice(j, 0, moved!);
      return next;
    });
  }

  function reorderItems(from: number, to: number) {
    setItems((prev) => {
      if (from === to || from < 0 || from >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      const insertAt = Math.max(0, Math.min(next.length, to));
      next.splice(insertAt, 0, moved!);
      return next;
    });
  }

  async function duplicate(id: string, label: string) {
    const res = await fetch(`/api/admin/workouts/${id}/duplicate`, {
      method: "POST",
      credentials: "include",
    });
    const p = await parseResponseJson<{ error?: string }>(res);
    if (p.parseError || !p.ok) {
      toast(p.body?.error ?? p.parseError ?? "Error al duplicar", "error");
      return;
    }
    await refresh();
    toast(`«${label}» duplicada. Edítala arriba si quieres cambiar algo.`, "success");
  }

  async function save() {
    const n = name.trim();
    if (!n) {
      toast("Pon un nombre a la rutina.", "error");
      return;
    }
    if (items.length === 0) {
      toast("Añade al menos un ejercicio.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: n,
        description: description.trim(),
        category,
        items: items.map((it) => ({
          exerciseId: it.exerciseId,
          sets: it.sets,
          reps: it.reps,
          restSec: it.restSec.trim() ? Number(it.restSec) : null,
          notes: it.notes.trim() || null,
        })),
      };
      const url = editingId
        ? `/api/admin/workouts/${editingId}`
        : "/api/admin/workouts";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const p = await parseResponseJson<{ error?: string }>(res);
      if (p.parseError) {
        toast(p.parseError, "error");
        return;
      }
      if (!p.ok) {
        toast(p.body?.error ?? "Error al guardar la rutina", "error");
        return;
      }
      resetEditor();
      await refresh();
      toast(
        editingId
          ? "Rutina actualizada. Los alumnos la verán al refrescar /rutina."
          : "Rutina creada. Los alumnos la verán al refrescar /rutina.",
        "success",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, label: string) {
    const ok = await confirm(`¿Eliminar la rutina «${label}»? No se puede deshacer.`);
    if (!ok) return;
    const res = await fetch(`/api/admin/workouts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const p = await parseResponseJson<{ error?: string }>(res);
    if (p.parseError || !p.ok) {
      toast(p.body?.error ?? p.parseError ?? "Error al borrar", "error");
      return;
    }
    if (editingId === id) resetEditor();
    await refresh();
    toast("Rutina eliminada.", "success");
  }

  const filteredLibrary = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return library.filter((ex) => {
      if (pickerCategory !== "all" && ex.category !== pickerCategory) return false;
      if (pickerEquipment !== "all" && (ex.equipment ?? "") !== pickerEquipment) return false;
      if (!q) return true;
      return (
        ex.name.toLowerCase().includes(q) ||
        ex.description.toLowerCase().includes(q)
      );
    });
  }, [library, pickerCategory, pickerEquipment, pickerSearch]);

  /** Equipamientos presentes en la biblioteca actual, para mostrar solo los útiles. */
  const availableEquipments = useMemo(() => {
    const present = new Set<string>();
    for (const ex of library) {
      if (ex.equipment) present.add(ex.equipment);
    }
    return EQUIPMENTS.filter((e) => present.has(e.id));
  }, [library]);

  /** Pausa el scroll del body cuando el picker está abierto (modal). */
  useEffect(() => {
    if (!pickerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pickerOpen]);

  const showSetup = !!setupHint;
  const noLibrary = !loadingLib && library.length === 0;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Mis rutinas (sesiones)</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Cada rutina contiene varios ejercicios con sus <strong>series</strong> y{" "}
          <strong>repeticiones</strong>. Los alumnos las ven en{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">
            /rutina/categoria/&lt;zona&gt;
          </code>
          . Componlas usando ejercicios de la biblioteca (más abajo en esta página).
        </p>
      </header>

      {showSetup ? (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100">
          {setupHint}
        </div>
      ) : null}
      {loadError ? (
        <div className="rounded-xl border border-red-300/70 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-700/40 dark:bg-red-950/40 dark:text-red-100">
          {loadError}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40">
        <h3 className="text-base font-semibold">
          {editingId ? "Editar rutina" : "Crear nueva rutina"}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Nombre, descripción opcional, categoría, y la lista de ejercicios con sus series/reps.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Nombre de la rutina
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTouched(true);
                }}
                maxLength={MAX_WORKOUT_NAME_LEN}
                placeholder={suggestNameFor(category) || 'Ej. "Empuje día 1"'}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
              {!name.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setName(suggestNameFor(category));
                    setNameTouched(true);
                  }}
                  className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                  title="Sugerir nombre"
                >
                  ✨
                </button>
              ) : null}
            </div>
          </label>
          <label className="block text-sm font-medium">
            Categoría principal
            <select
              value={category}
              onChange={(e) => {
                const next = e.target.value as RoutineCategoryId;
                setCategory(next);
                // Si el usuario aún no ha escrito un nombre propio, lo
                // resugerimos para la nueva categoría.
                if (!nameTouched) {
                  setName(suggestNameFor(next));
                }
              }}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            >
              {ROUTINE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Descripción (opcional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={MAX_WORKOUT_DESC_LEN}
              placeholder="Objetivo, notas globales, calentamiento sugerido…"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
        </div>

        <div className="mt-5">
          <h4 className="text-sm font-semibold">
            Esquema rápido{" "}
            <span className="ml-1 text-[11px] font-normal text-zinc-500">
              (define series y descanso para los ejercicios nuevos)
            </span>
          </h4>
          <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {ROUTINE_TEMPLATES.map((t) => {
              const active = templateId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTemplateId(t.id);
                    if (items.length > 0 && t.id !== "custom") {
                      applyTemplateToAll(t);
                    }
                  }}
                  className={`shrink-0 rounded-xl border-2 px-3 py-2 text-left transition active:scale-[0.97] ${
                    active
                      ? "border-emerald-500 bg-emerald-50 shadow-sm dark:bg-emerald-950/40"
                      : "border-zinc-200 bg-white hover:border-emerald-300 dark:border-zinc-700 dark:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-base leading-none">{t.icon}</span>
                    <span className="text-xs font-semibold">{t.label}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-500">
                    {t.short}
                    {t.id !== "custom" ? ` · ${t.restSec}s desc.` : ""}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold">
              Ejercicios{" "}
              <span className="ml-1 text-xs font-normal text-zinc-500">
                ({items.length}/{MAX_WORKOUT_ITEMS})
              </span>
              {items.length >= 2 ? (
                <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  ~ {estimateDurationMin(items)} min
                </span>
              ) : null}
            </h4>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              disabled={noLibrary}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
            >
              {pickerOpen ? "Cerrar selector" : "+ Añadir ejercicio"}
            </button>
          </div>
          {noLibrary ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              No hay ejercicios en la biblioteca todavía. Crea al menos uno en la sección de abajo y
              vuelve aquí.
            </p>
          ) : null}

          {pickerOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Selector de ejercicios"
              className="fixed inset-0 z-[80] flex flex-col bg-white dark:bg-zinc-950"
            >
              <header className="sticky top-0 z-10 flex flex-col gap-2 border-b border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold">Elegir ejercicios</h3>
                    <p className="truncate text-[11px] text-zinc-500">
                      {filteredLibrary.length} disponible{filteredLibrary.length === 1 ? "" : "s"}
                      {pickerSelectedIds.size > 0
                        ? ` · ${pickerSelectedIds.size} marcado${pickerSelectedIds.size === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPickerOpen(false);
                      setPickerSelectedIds(new Set());
                    }}
                    aria-label="Cerrar selector"
                    className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <input
                  type="search"
                  autoFocus
                  placeholder="Buscar ejercicio…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />

                <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
                  <PickerChip
                    active={pickerCategory === "all"}
                    onClick={() => setPickerCategory("all")}
                  >
                    Todas las zonas
                  </PickerChip>
                  {ROUTINE_CATEGORIES.map((c) => (
                    <PickerChip
                      key={c.id}
                      active={pickerCategory === c.id}
                      onClick={() => setPickerCategory(c.id)}
                    >
                      {c.label}
                    </PickerChip>
                  ))}
                </div>

                {availableEquipments.length > 0 ? (
                  <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
                    <PickerChip
                      tone="slate"
                      active={pickerEquipment === "all"}
                      onClick={() => setPickerEquipment("all")}
                    >
                      Todo equipo
                    </PickerChip>
                    {availableEquipments.map((eq) => (
                      <PickerChip
                        key={eq.id}
                        tone="slate"
                        active={pickerEquipment === eq.id}
                        onClick={() => setPickerEquipment(eq.id)}
                      >
                        {eq.label}
                      </PickerChip>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2">
                  {filteredLibrary.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const visibleIds = filteredLibrary.map((ex) => ex.id);
                        const allMarked = visibleIds.every((id) =>
                          pickerSelectedIds.has(id),
                        );
                        setPickerSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (allMarked) {
                            visibleIds.forEach((id) => next.delete(id));
                          } else {
                            visibleIds.forEach((id) => next.add(id));
                          }
                          return next;
                        });
                      }}
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
                    >
                      {filteredLibrary.every((ex) => pickerSelectedIds.has(ex.id))
                        ? "Quitar visibles"
                        : "Marcar todos los visibles"}
                    </button>
                  ) : <span />}
                  {pickerSelectedIds.size > 0 ? (
                    <button
                      type="button"
                      onClick={() => setPickerSelectedIds(new Set())}
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Limpiar selección
                    </button>
                  ) : null}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-3 py-3 pb-28">
                {filteredLibrary.length === 0 ? (
                  <p className="py-12 text-center text-sm text-zinc-500">
                    No hay ejercicios que coincidan con esos filtros.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {filteredLibrary.map((ex) => {
                      const checked = pickerSelectedIds.has(ex.id);
                      return (
                        <li key={ex.id}>
                          <button
                            type="button"
                            onClick={() => togglePickerSelection(ex.id)}
                            aria-pressed={checked}
                            className={`group relative flex w-full flex-col overflow-hidden rounded-xl border-2 text-left transition active:scale-[0.98] ${
                              checked
                                ? "border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-300 ring-offset-1 dark:bg-emerald-950/30 dark:ring-emerald-700"
                                : "border-zinc-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-emerald-600"
                            }`}
                          >
                            <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-800">
                              <img
                                src={previewSrc(ex)}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                                onError={withRoutineFallback}
                              />
                              <div
                                className={`pointer-events-none absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm ${
                                  checked
                                    ? "border-white bg-emerald-600 text-white"
                                    : "border-white bg-white/90 text-transparent"
                                }`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12l5 5L20 7" />
                                </svg>
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5 p-2">
                              <p className="line-clamp-2 text-[11.5px] font-semibold leading-tight">
                                {ex.name}
                              </p>
                              <p className="truncate text-[10px] text-zinc-500">
                                {routineCategoryLabel(normalizeRoutineCategory(ex.category))}
                                {ex.equipment ? ` · ${equipmentLabel(ex.equipment)}` : ""}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <footer className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-zinc-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] dark:border-zinc-800 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen(false);
                    setPickerSelectedIds(new Set());
                  }}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addSelectedExercisesToDraft();
                    setPickerOpen(false);
                  }}
                  disabled={pickerSelectedIds.size === 0}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Añadir {pickerSelectedIds.size > 0 ? `${pickerSelectedIds.size} ` : ""}
                  ejercicio{pickerSelectedIds.size === 1 ? "" : "s"}
                </button>
              </footer>
            </div>
          ) : null}

          {items.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-500 dark:border-zinc-600">
              Aún no añadiste ejercicios. Pulsa «+ Añadir ejercicio» y elige uno de la biblioteca.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {items.map((it, idx) => (
                <li
                  key={`${it.exerciseId}-${idx}`}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(idx);
                    e.dataTransfer.effectAllowed = "move";
                    try {
                      e.dataTransfer.setData("text/plain", String(idx));
                    } catch {}
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverIndex !== idx) setDragOverIndex(idx);
                  }}
                  onDragLeave={() => {
                    if (dragOverIndex === idx) setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from =
                      dragIndex ??
                      Number(e.dataTransfer.getData("text/plain"));
                    if (Number.isFinite(from)) reorderItems(from, idx);
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`rounded-xl border bg-white p-3 transition dark:bg-zinc-900/60 ${
                    dragIndex === idx
                      ? "border-emerald-500/70 opacity-50"
                      : dragOverIndex === idx
                        ? "border-emerald-500 ring-2 ring-emerald-300/50 dark:ring-emerald-800/50"
                        : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-950">
                      <img
                        src={it.exerciseThumbUrl || it.exerciseGifUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                        onError={withRoutineFallback}
                      />
                      <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow">
                        {idx + 1}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {it.exerciseName}
                      </p>

                      {/* Fila compacta: Series stepper + Reps inline */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center rounded-lg border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900">
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(idx, {
                                sets: Math.max(MIN_SETS, it.sets - 1),
                              })
                            }
                            disabled={it.sets <= MIN_SETS}
                            aria-label="Una serie menos"
                            className="h-9 w-9 text-base leading-none disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="min-w-[2.5rem] text-center text-sm font-bold tabular-nums">
                            {it.sets}×
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(idx, {
                                sets: Math.min(MAX_SETS, it.sets + 1),
                              })
                            }
                            disabled={it.sets >= MAX_SETS}
                            aria-label="Una serie más"
                            className="h-9 w-9 text-base leading-none disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>

                        <input
                          type="text"
                          inputMode="text"
                          value={it.reps}
                          onChange={(e) =>
                            updateItem(idx, { reps: e.target.value.slice(0, MAX_REPS_LEN) })
                          }
                          placeholder="12 ó 12-15"
                          aria-label="Repeticiones"
                          className="h-9 w-24 rounded-lg border border-zinc-300 bg-white px-2 text-center text-sm font-semibold dark:border-zinc-600 dark:bg-zinc-900"
                        />

                        <button
                          type="button"
                          onClick={() => setExpandedItemIdx(expandedItemIdx === idx ? -1 : idx)}
                          aria-expanded={expandedItemIdx === idx}
                          className={`h-9 rounded-lg border px-2 text-xs font-medium ${
                            expandedItemIdx === idx
                              ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                              : "border-zinc-300 bg-white text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                          }`}
                        >
                          {expandedItemIdx === idx ? "▲ Menos" : "⋯ Más"}
                        </button>

                        <span className="ml-auto inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveItem(idx, -1)}
                            disabled={idx === 0}
                            aria-label="Subir"
                            className="h-9 w-8 rounded-md border border-zinc-300 bg-white text-xs disabled:opacity-30 dark:border-zinc-600 dark:bg-zinc-900"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(idx, 1)}
                            disabled={idx === items.length - 1}
                            aria-label="Bajar"
                            className="h-9 w-8 rounded-md border border-zinc-300 bg-white text-xs disabled:opacity-30 dark:border-zinc-600 dark:bg-zinc-900"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            aria-label="Quitar"
                            className="h-9 w-9 rounded-md border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
                            title="Quitar de la rutina"
                          >
                            ✕
                          </button>
                        </span>
                      </div>

                      {/* Acordeón con campos avanzados */}
                      {expandedItemIdx === idx ? (
                        <div className="mt-3 grid gap-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/40 sm:grid-cols-2">
                          <label className="block text-xs font-medium">
                            Descanso entre series
                            <div className="mt-1 inline-flex items-center rounded-lg border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900">
                              <button
                                type="button"
                                onClick={() => {
                                  const n = Math.max(0, (Number(it.restSec) || 0) - 15);
                                  updateItem(idx, { restSec: String(n) });
                                }}
                                aria-label="Menos descanso"
                                className="h-9 w-9 text-base leading-none"
                              >
                                −
                              </button>
                              <span className="min-w-[4rem] text-center text-sm font-bold tabular-nums">
                                {it.restSec || "0"}s
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const n = Math.min(600, (Number(it.restSec) || 0) + 15);
                                  updateItem(idx, { restSec: String(n) });
                                }}
                                aria-label="Más descanso"
                                className="h-9 w-9 text-base leading-none"
                              >
                                +
                              </button>
                            </div>
                          </label>
                          <label className="block text-xs font-medium">
                            Nota (RIR, técnica…)
                            <input
                              type="text"
                              value={it.notes}
                              onChange={(e) =>
                                updateItem(idx, { notes: e.target.value.slice(0, MAX_NOTES_LEN) })
                              }
                              placeholder="RIR 2, drop set…"
                              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Espaciador para evitar que la sticky bar tape el último item. */}
        <div className="h-24" aria-hidden />
      </div>

      {/* Sticky bottom bar: el botón Guardar siempre visible en mobile y
          desktop, con el FAB redondo para volver a abrir el picker en cualquier
          momento sin tener que hacer scroll. Solo se renderiza si hay editor
          activo (nombre o ejercicios), para no estorbar al ver la lista. */}
      {(items.length > 0 || name.trim() || editingId) && !pickerOpen ? (
        <div className="sticky bottom-3 z-30 mx-[-0.25rem] flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/95 p-2 shadow-2xl backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={noLibrary || items.length >= MAX_WORKOUT_ITEMS}
            aria-label="Añadir ejercicios"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white shadow-lg hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            title="Añadir ejercicios"
          >
            +
          </button>
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-semibold">
              {items.length === 0
                ? "Añade ejercicios para empezar"
                : `${items.length} ejercicio${items.length === 1 ? "" : "s"} · ~${estimateDurationMin(items)} min`}
            </p>
            <p className="truncate text-zinc-500">
              {name.trim() ? name : "Escribe un nombre arriba"}
            </p>
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={resetEditor}
              className="h-12 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || items.length === 0 || !name.trim()}
            className="h-12 shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "…" : editingId ? "Guardar" : "Crear"}
          </button>
        </div>
      ) : null}

      <div>
        <h3 className="text-base font-semibold">
          Rutinas existentes ({workouts?.length ?? 0})
        </h3>
        {workouts === null ? (
          <p className="mt-2 text-sm text-zinc-500">Cargando…</p>
        ) : workouts.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Aún no hay rutinas. Crea la primera arriba.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {workouts.map((w) => (
              <li
                key={w.id}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      {routineCategoryLabel(normalizeRoutineCategory(w.category))}
                    </p>
                    <p className="mt-0.5 text-base font-semibold">{w.name}</p>
                    {w.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {w.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-500">
                      {w.items.length} ejercicio{w.items.length === 1 ? "" : "s"}
                    </p>
                    {w.items.length > 0 ? (
                      <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-zinc-600 dark:text-zinc-300 sm:grid-cols-2">
                        {w.items.map((it, i) => (
                          <li key={it.id} className="truncate">
                            <span className="text-zinc-400">{i + 1}.</span>{" "}
                            {it.exercise.name}{" "}
                            <span className="text-zinc-500">
                              · {it.sets}×{it.reps}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(w)}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void duplicate(w.id, w.name)}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(w.id, w.name)}
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Chip horizontal usado en el header del picker fullscreen. Dos tonos:
 * "emerald" (zonas) y "slate" (equipamiento) para diferenciar visualmente
 * cada hilera de filtros sin saturar.
 */
function PickerChip({
  active,
  onClick,
  children,
  tone = "emerald",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "emerald" | "slate";
}) {
  const activeCls =
    tone === "emerald"
      ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
      : "border-slate-700 bg-slate-700 text-white shadow-sm dark:border-slate-300 dark:bg-slate-200 dark:text-slate-900";
  const idleCls =
    "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${active ? activeCls : idleCls}`}
    >
      {children}
    </button>
  );
}
