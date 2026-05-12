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
  category: string;
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
  exerciseCategory: string;
  sets: number;
  reps: string;
  restSec: string;
  notes: string;
};

function emptyDraftItem(ex: ExerciseRow): DraftItem {
  return {
    exerciseId: ex.id,
    exerciseName: ex.name,
    exerciseGifUrl: ex.gifUrl,
    exerciseCategory: ex.category,
    sets: 4,
    reps: "12",
    restSec: "",
    notes: "",
  };
}

function itemFromServer(it: WorkoutItem): DraftItem {
  return {
    exerciseId: it.exercise.id,
    exerciseName: it.exercise.name,
    exerciseGifUrl: it.exercise.gifUrl,
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
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RoutineCategoryId>(
    DEFAULT_ROUTINE_CATEGORY,
  );
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Selector de ejercicios (modal inline)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<RoutineCategoryId | "all">(
    "all",
  );
  const [pickerSearch, setPickerSearch] = useState("");

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
    setDescription("");
    setCategory(DEFAULT_ROUTINE_CATEGORY);
    setItems([]);
  }

  function startEdit(w: Workout) {
    setEditingId(w.id);
    setName(w.name);
    setDescription(w.description);
    setCategory(normalizeRoutineCategory(w.category));
    setItems(w.items.map(itemFromServer));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addExerciseToDraft(ex: ExerciseRow) {
    if (items.length >= MAX_WORKOUT_ITEMS) {
      toast(`Máximo ${MAX_WORKOUT_ITEMS} ejercicios por rutina.`, "error");
      return;
    }
    setItems((prev) => [...prev, emptyDraftItem(ex)]);
    setPickerOpen(false);
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
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
      if (!q) return true;
      return (
        ex.name.toLowerCase().includes(q) ||
        ex.description.toLowerCase().includes(q)
      );
    });
  }, [library, pickerCategory, pickerSearch]);

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
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_WORKOUT_NAME_LEN}
              placeholder='Ej. "Empuje día 1"'
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <label className="block text-sm font-medium">
            Categoría principal
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RoutineCategoryId)}
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
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold">
              Ejercicios{" "}
              <span className="ml-1 text-xs font-normal text-zinc-500">
                ({items.length}/{MAX_WORKOUT_ITEMS})
              </span>
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
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  placeholder="Buscar por nombre o descripción…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                />
                <select
                  value={pickerCategory}
                  onChange={(e) =>
                    setPickerCategory(e.target.value as RoutineCategoryId | "all")
                  }
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                >
                  <option value="all">Todas las zonas</option>
                  {ROUTINE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 max-h-72 overflow-y-auto">
                {filteredLibrary.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-500">
                    Sin resultados para esa búsqueda.
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {filteredLibrary.map((ex) => (
                      <li key={ex.id}>
                        <button
                          type="button"
                          onClick={() => addExerciseToDraft(ex)}
                          className="flex w-full items-center gap-3 px-2 py-2 text-left transition hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30"
                        >
                          <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-950">
                            <img
                              src={ex.gifUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-contain"
                              onError={withRoutineFallback}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{ex.name}</p>
                            <p className="truncate text-[11px] text-zinc-500">
                              {routineCategoryLabel(normalizeRoutineCategory(ex.category))}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 cursor-grab select-none rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-zinc-500 active:cursor-grabbing dark:border-zinc-600 dark:bg-zinc-800"
                      title="Arrastra para reordenar"
                      aria-hidden
                    >
                      ⋮⋮
                    </span>
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-950">
                      <img
                        src={it.exerciseGifUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain"
                        onError={withRoutineFallback}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {idx + 1}. {it.exerciseName}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {routineCategoryLabel(
                              normalizeRoutineCategory(it.exerciseCategory),
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveItem(idx, -1)}
                            disabled={idx === 0}
                            aria-label="Subir"
                            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs disabled:opacity-30 dark:border-zinc-600 dark:bg-zinc-900"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(idx, 1)}
                            disabled={idx === items.length - 1}
                            aria-label="Bajar"
                            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs disabled:opacity-30 dark:border-zinc-600 dark:bg-zinc-900"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <label className="block text-xs font-medium">
                          Series
                          <input
                            type="number"
                            inputMode="numeric"
                            min={MIN_SETS}
                            max={MAX_SETS}
                            step={1}
                            value={it.sets}
                            onChange={(e) =>
                              updateItem(idx, {
                                sets: Math.max(
                                  MIN_SETS,
                                  Math.min(MAX_SETS, Number(e.target.value) || MIN_SETS),
                                ),
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                          />
                        </label>
                        <label className="block text-xs font-medium">
                          Reps
                          <input
                            type="text"
                            inputMode="text"
                            value={it.reps}
                            onChange={(e) =>
                              updateItem(idx, { reps: e.target.value.slice(0, MAX_REPS_LEN) })
                            }
                            placeholder='12 ó 12-15'
                            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                          />
                        </label>
                        <label className="block text-xs font-medium">
                          Descanso (seg)
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={600}
                            step={5}
                            value={it.restSec}
                            onChange={(e) => updateItem(idx, { restSec: e.target.value })}
                            placeholder="60"
                            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                          />
                        </label>
                        <label className="block text-xs font-medium sm:col-span-1">
                          Nota
                          <input
                            type="text"
                            value={it.notes}
                            onChange={(e) =>
                              updateItem(idx, { notes: e.target.value.slice(0, MAX_NOTES_LEN) })
                            }
                            placeholder='RIR 2, drop set…'
                            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                          />
                        </label>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        Resumen:{" "}
                        <strong className="text-zinc-800 dark:text-zinc-200">
                          {it.sets} series × {it.reps || "—"}
                        </strong>
                        {it.restSec ? ` · descanso ${it.restSec}s` : ""}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || items.length === 0 || !name.trim()}
            className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Guardando…"
              : editingId
                ? "Guardar cambios"
                : "Crear rutina"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetEditor}
              className="min-h-[44px] rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Cancelar edición
            </button>
          ) : null}
        </div>
      </div>

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
