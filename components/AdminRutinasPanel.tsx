"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseResponseJson } from "@/lib/parse-response-json";
import { ROUTINE_SETUP_ADMIN_HINT } from "@/lib/prisma-routine-health";
import { presetLabelForPath } from "@/lib/routine-image-presets";
import {
  ROUTINE_GALLERY_ASSETS,
  galleryLabelForPath,
  galleryPathBasename,
} from "@/lib/routine-gallery-assets";
import {
  ROUTINE_CATEGORIES,
  type RoutineCategoryId,
  DEFAULT_ROUTINE_CATEGORY,
  isRoutineCategoryId,
  normalizeRoutineCategory,
  routineCategoryLabel,
} from "@/lib/routine-categories";
import { useToast } from "@/components/ToastProvider";

type Routine = {
  id: string;
  name: string;
  description: string;
  gifUrl: string;
  category?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Una subcarpeta en `public/images/routines/uploads/` con sus GIFs. */
type UploadFolderEntry = {
  folder: string;
  category: RoutineCategoryId;
  matchesCategory: boolean;
  files: { name: string; url: string }[];
};

/** Atributos no tipados por React para `<input>` de selección de carpeta. */
const FOLDER_INPUT_ATTRS = {
  webkitdirectory: "",
  directory: "",
} as unknown as Record<string, string>;

/** Tamaño de lote para enviar al server (límite duro del endpoint: 80). */
const UPLOAD_CHUNK_SIZE = 30;
const ALLOWED_UPLOAD_EXT = /\.(gif|jpe?g|png|webp)$/i;

export function AdminRutinasPanel() {
  const router = useRouter();
  const { toast, confirm } = useToast();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Base de rutinas no lista (Prisma / tablas): mensaje informativo, sin texto rojo de error técnico. */
  const [setupHint, setSetupHint] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  /** Con IA disponible: «ai» genera desde texto; «manual» = ilustración elegida en la galería. */
  const [illustrationChoice, setIllustrationChoice] = useState<"ai" | "manual">("manual");
  const [categoryForm, setCategoryForm] = useState<RoutineCategoryId>(DEFAULT_ROUTINE_CATEGORY);
  const [galleryFilesOnDisk, setGalleryFilesOnDisk] = useState<string[] | null>(null);
  const [thumbLoadFailed, setThumbLoadFailed] = useState<Record<string, boolean>>({});
  const [uploadTree, setUploadTree] = useState<UploadFolderEntry[] | null>(null);
  /** Mensaje de progreso mientras se sube una carpeta seleccionada. */
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadingFolders, setUploadingFolders] = useState(false);

  const missingGalleryOnDisk = useMemo(() => {
    if (galleryFilesOnDisk === null) return [];
    const set = new Set(galleryFilesOnDisk);
    return ROUTINE_GALLERY_ASSETS.filter((a) => !set.has(galleryPathBasename(a.path))).map(
      (a) => galleryPathBasename(a.path),
    );
  }, [galleryFilesOnDisk]);

  const refresh = useCallback(async () => {
    setLoadError(null);
    setSetupHint(null);
    const res = await fetch("/api/admin/routines", { credentials: "include" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const parsed = await parseResponseJson<{
      routines?: Routine[];
      error?: string;
      setupRequired?: boolean;
      setupHint?: string;
    }>(res);
    if (parsed.parseError || !parsed.body) {
      setLoadError(parsed.parseError ?? "No se pudo leer la respuesta del servidor.");
      setRoutines([]);
      return;
    }
    if (!parsed.ok) {
      setLoadError(parsed.body.error ?? "No se pudieron cargar las rutinas.");
      setRoutines([]);
      return;
    }
    const body = parsed.body;
    setRoutines(body.routines ?? []);
    if (body.setupRequired) {
      setSetupHint((body.setupHint && body.setupHint.trim()) || ROUTINE_SETUP_ADMIN_HINT);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/routines/ai-status", { credentials: "include" });
      if (cancelled) return;
      if (res.status === 401) {
        setAiAvailable(false);
        return;
      }
      const p = await parseResponseJson<{
        imageGenerationAvailable?: boolean;
      }>(res);
      if (cancelled) return;
      if (p.parseError || !p.ok || !p.body) {
        setAiAvailable(false);
        return;
      }
      const ok = Boolean(p.body.imageGenerationAvailable);
      setAiAvailable(ok);
      if (ok) setIllustrationChoice("ai");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshGalleryFiles = useCallback(async () => {
    const res = await fetch("/api/admin/gallery-files", { credentials: "include" });
    if (res.status === 401) {
      setGalleryFilesOnDisk([]);
      return;
    }
    if (!res.ok) {
      setGalleryFilesOnDisk([]);
      return;
    }
    const j = (await res.json().catch(() => ({}))) as { files?: string[] };
    setGalleryFilesOnDisk(j.files ?? []);
  }, []);

  useEffect(() => {
    void refreshGalleryFiles();
  }, [refreshGalleryFiles]);

  const refreshUploadTree = useCallback(async () => {
    const res = await fetch("/api/admin/uploads/tree", { credentials: "include" });
    if (res.status === 401) {
      setUploadTree([]);
      return;
    }
    const p = await parseResponseJson<{ tree?: UploadFolderEntry[] }>(res);
    if (!p.ok || p.parseError || !p.body) {
      setUploadTree([]);
      return;
    }
    setUploadTree(Array.isArray(p.body.tree) ? p.body.tree : []);
  }, []);

  useEffect(() => {
    void refreshUploadTree();
  }, [refreshUploadTree]);

  /**
   * Recibe el FileList de un `<input type="file" webkitdirectory>`,
   * agrupa por subcarpeta de primer nivel y sube cada subcarpeta al server.
   *
   * - Si un archivo está en la raíz seleccionada (sin subcarpeta), se asigna
   *   a la carpeta lógica `general`.
   * - Si está en una subcarpeta cuyo nombre coincide con un slug de
   *   `routine-categories` (`biceps`, `piernas`, …) se categoriza
   *   automáticamente al elegirlo en una rutina.
   */
  async function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = e.target.files;
    if (!fl || fl.length === 0) {
      return;
    }
    const buckets = new Map<string, File[]>();
    for (const f of Array.from(fl)) {
      if (!ALLOWED_UPLOAD_EXT.test(f.name)) continue;
      const rel =
        (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
      const parts = rel.split("/").filter(Boolean);
      let folder: string;
      if (parts.length >= 3) {
        folder = parts[parts.length - 2]!;
      } else if (parts.length === 2) {
        folder = "general";
      } else {
        continue;
      }
      const key = folder.toLowerCase();
      const list = buckets.get(key) ?? [];
      list.push(f);
      buckets.set(key, list);
    }

    e.target.value = "";

    if (buckets.size === 0) {
      toast(
        "No hay archivos válidos en la carpeta seleccionada (.gif/.jpg/.png/.webp).",
        "error",
      );
      return;
    }

    setUploadingFolders(true);
    let totalWritten = 0;
    let totalSkipped = 0;
    try {
      for (const [folder, files] of buckets) {
        const total = files.length;
        for (let i = 0; i < files.length; i += UPLOAD_CHUNK_SIZE) {
          const slice = files.slice(i, i + UPLOAD_CHUNK_SIZE);
          setUploadStatus(
            `Subiendo "${folder}" (${Math.min(i + slice.length, total)}/${total})…`,
          );
          const fd = new FormData();
          fd.append("folder", folder);
          for (const f of slice) fd.append("files", f, f.name);
          const res = await fetch("/api/admin/uploads", {
            method: "POST",
            credentials: "include",
            body: fd,
          });
          if (res.status === 401) {
            router.replace("/admin/login");
            return;
          }
          const p = await parseResponseJson<{
            written?: { name: string; url: string }[];
            skipped?: { name: string; reason: string }[];
            error?: string;
          }>(res);
          if (p.parseError) {
            toast(p.parseError, "error");
            return;
          }
          if (!p.ok || !p.body) {
            toast(p.body?.error ?? `Error subiendo "${folder}"`, "error");
            return;
          }
          totalWritten += p.body.written?.length ?? 0;
          totalSkipped += p.body.skipped?.length ?? 0;
        }
      }
      await refreshUploadTree();
      toast(
        totalSkipped === 0
          ? `Subidos ${totalWritten} archivo(s) en ${buckets.size} carpeta(s).`
          : `Subidos ${totalWritten}; ${totalSkipped} omitido(s) por nombre o tamaño.`,
        totalSkipped === 0 ? "success" : "info",
      );
    } finally {
      setUploadingFolders(false);
      setUploadStatus(null);
    }
  }

  function pickUploadAsset(folder: string, url: string) {
    setGifUrl(url);
    setIllustrationChoice("manual");
    if (isRoutineCategoryId(folder)) {
      setCategoryForm(folder);
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setGifUrl("");
    setEditing(null);
    setCategoryForm(DEFAULT_ROUTINE_CATEGORY);
    setIllustrationChoice(aiAvailable ? "ai" : "manual");
  }

  async function createRoutine() {
    const n = name.trim();
    const d = description.trim();
    const g = gifUrl.trim();
    const withAi = aiAvailable && illustrationChoice === "ai";
    if (!n || !d) {
      toast("Completa nombre y descripción.", "error");
      return;
    }
    if (!withAi && !g) {
      toast("Indica una ilustración: elige una fila de la galería o «Generar con IA».", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = withAi
        ? { name: n, description: d, generateImage: true, category: categoryForm }
        : { name: n, description: d, gifUrl: g, category: categoryForm };
      const res = await fetch("/api/admin/routines", {
        method: "POST",
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
        toast(p.body?.error ?? "Error al crear", "error");
        return;
      }
      resetForm();
      await refresh();
      toast(
        withAi
          ? "Rutina creada con ilustración IA. Los alumnos la verán en /rutina (pueden pulsar «Actualizar listado»)."
          : "Rutina guardada en la base de datos. Los alumnos la verán en /rutina al actualizar o al volver a esta página.",
        "success",
      );
    } finally {
      setSaving(false);
    }
  }

  async function regenerateAiImage() {
    if (!editing) return;
    if (!aiAvailable) {
      toast("Generación IA no disponible en el servidor.", "error");
      return;
    }
    const n = name.trim();
    const d = description.trim();
    if (!n || !d) {
      toast("Nombre y descripción son necesarios para regenerar la ilustración.", "error");
      return;
    }
    setAiBusy(true);
    try {
      const res = await fetch(`/api/admin/routines/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regenerateImage: true,
          name: n,
          description: d,
        }),
      });
      const p = await parseResponseJson<{ routine?: Routine; error?: string }>(res);
      if (p.parseError) {
        toast(p.parseError, "error");
        return;
      }
      if (!p.ok) {
        toast(p.body?.error ?? "Error al regenerar", "error");
        return;
      }
      const nextUrl = p.body?.routine?.gifUrl;
      if (nextUrl) {
        setGifUrl(nextUrl);
        setEditing((prev) => (prev ? { ...prev, gifUrl: nextUrl } : null));
      }
      await refresh();
      toast("Ilustración IA actualizada.", "success");
    } finally {
      setAiBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const n = name.trim();
    const d = description.trim();
    const g = gifUrl.trim();
    if (!n || !d || !g) {
      toast("Completa todos los campos.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/routines/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, description: d, gifUrl: g, category: categoryForm }),
      });
      const p = await parseResponseJson<{ error?: string }>(res);
      if (p.parseError) {
        toast(p.parseError, "error");
        return;
      }
      if (!p.ok) {
        toast(p.body?.error ?? "Error al guardar", "error");
        return;
      }
      resetForm();
      await refresh();
      toast("Rutina actualizada. Los cambios se reflejan en /rutina para los alumnos al actualizar.", "success");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm("¿Eliminar esta rutina? No se puede deshacer.");
    if (!ok) return;
    const res = await fetch(`/api/admin/routines/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const p = await parseResponseJson<{ error?: string }>(res);
    if (p.parseError || !p.ok) {
      toast(p.body?.error ?? p.parseError ?? "Error al borrar", "error");
      return;
    }
    if (editing?.id === id) resetForm();
    await refresh();
    toast("Rutina eliminada.", "success");
  }

  function startEdit(r: Routine) {
    setEditing(r);
    setName(r.name);
    setDescription(r.description);
    setGifUrl(r.gifUrl);
    setCategoryForm(normalizeRoutineCategory(r.category));
  }

  function pickGalleryAsset(path: string) {
    setGifUrl(path);
    setIllustrationChoice("manual");
  }

  const previewUrl = gifUrl.trim();
  const saveBlocked = Boolean(setupHint);

  return (
    <div className="min-w-0 space-y-8">
      {setupHint ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/35 dark:text-amber-50">
          <p className="font-semibold">Rutinas: configuración del servidor</p>
          <p className="mt-2 leading-relaxed">{setupHint}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-3 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/70"
          >
            Reintentar carga
          </button>
        </div>
      ) : null}
      {loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold">
          {editing ? "Editar rutina" : "Nueva rutina"}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium sm:col-span-2">
            Nombre
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saveBlocked}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Descripción breve
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={saveBlocked}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Tipo de rutina (catálogo para el alumno)
            <select
              value={categoryForm}
              onChange={(e) => setCategoryForm(e.target.value as RoutineCategoryId)}
              disabled={saveBlocked}
              className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900"
            >
              {ROUTINE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.hint ? ` — ${c.hint}` : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-zinc-500">
              El alumno filtra por esta zona en la página «Rutinas».
            </span>
          </label>
          {!editing && aiAvailable ? (
            <fieldset
              disabled={saveBlocked}
              className="sm:col-span-2 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800/40"
            >
              <legend className="px-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Ilustración
              </legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2 hover:border-zinc-300 dark:hover:border-zinc-600">
                <input
                  type="radio"
                  name="routine-illustration"
                  checked={illustrationChoice === "ai"}
                  onChange={() => setIllustrationChoice("ai")}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">Generar con IA</span>
                  <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">
                    Imagen única a partir del nombre y la descripción (OpenAI, PNG estático).
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2 hover:border-zinc-300 dark:hover:border-zinc-600">
                <input
                  type="radio"
                  name="routine-illustration"
                  checked={illustrationChoice === "manual"}
                  onChange={() => setIllustrationChoice("manual")}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">Galería del sistema</span>
                  <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">
                    Elige una fila en la lista de ilustraciones debajo.
                  </span>
                </span>
              </label>
            </fieldset>
          ) : null}

          {editing && aiAvailable ? (
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={aiBusy || saving || saveBlocked}
                onClick={() => void regenerateAiImage()}
                className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/40"
              >
                {aiBusy ? "Regenerando ilustración…" : "Regenerar ilustración IA"}
              </button>
              <p className="mt-1 text-xs text-zinc-500">
                Usa el nombre y la descripción del formulario; guarda el resto con «Guardar cambios».
              </p>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            {missingGalleryOnDisk.length > 0 ? (
              <div className="mb-3 rounded-xl border border-amber-300/80 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
                <p className="font-medium">Algunas ilustraciones no están en el disco del servidor</p>
                <p className="mt-1 text-xs leading-relaxed opacity-95">
                  Faltan en <code className="rounded bg-black/5 px-1 text-[11px] dark:bg-white/10">public/images/routines/gallery/</code>
                  {missingGalleryOnDisk.length > 6 ? " (entre otras): " : ": "}
                  <span className="font-mono break-all text-[11px]">
                    {missingGalleryOnDisk.slice(0, 8).join(", ")}
                    {missingGalleryOnDisk.length > 8 ? "…" : ""}
                  </span>
                </p>
                <p className="mt-1.5 text-xs leading-relaxed">
                  Copia los archivos a <code className="rounded bg-black/5 px-1">public/images/routines/gallery/</code>, usa{" "}
                  <code className="rounded bg-black/5 px-1">./scripts/install-routine-gallery-from-mappings.mjs</code> o{" "}
                  <code className="rounded bg-black/5 px-1">./scripts/copy-gallery-nuevos.sh</code>; luego{" "}
                  <button
                    type="button"
                    onClick={() => void refreshGalleryFiles()}
                    className="font-medium text-amber-900 underline dark:text-amber-200"
                  >
                    volver a comprobar
                  </button>
                  .
                </p>
              </div>
            ) : null}
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Galería de ilustraciones (una por fila)
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Archivos incluidos en la app. Pulsa una fila para asignarla (si tenías IA, cambia a galería del
              sistema).
            </p>
            <div className="mt-2 max-h-[min(70vh,560px)] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-600">
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {ROUTINE_GALLERY_ASSETS.map((p) => {
                  const selected = gifUrl.trim() === p.path;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={saving || aiBusy || saveBlocked}
                        onClick={() => pickGalleryAsset(p.path)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition disabled:opacity-50 ${
                          selected
                            ? "bg-emerald-50 dark:bg-emerald-950/40"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                        }`}
                      >
                        <div className="relative flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-600 dark:bg-zinc-800">
                          {thumbLoadFailed[p.id] ? (
                            <span className="px-1 text-center text-[9px] leading-tight text-zinc-500">
                              Archivo
                              <br />
                              no encontrado
                            </span>
                          ) : (
                            <img
                              src={p.path}
                              alt=""
                              className="max-h-full max-w-full object-contain"
                              loading="lazy"
                              onError={() => {
                                setThumbLoadFailed((prev) => ({ ...prev, [p.id]: true }));
                              }}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.label}</p>
                          <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">{p.path}</p>
                        </div>
                        {selected ? (
                          <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Mis carpetas (subir GIFs en lote)
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                    Selecciona una carpeta de tu PC con subcarpetas (ej.{" "}
                    <code className="rounded bg-black/5 px-1 text-[11px] dark:bg-white/10">
                      biceps/
                    </code>
                    ,{" "}
                    <code className="rounded bg-black/5 px-1 text-[11px] dark:bg-white/10">
                      piernas/
                    </code>
                    …). Si el nombre coincide con un tipo de rutina, al elegir un GIF se
                    asigna esa categoría automáticamente.
                  </p>
                </div>
                <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40">
                  <input
                    type="file"
                    multiple
                    accept=".gif,.jpg,.jpeg,.png,.webp,image/gif,image/jpeg,image/png,image/webp"
                    disabled={uploadingFolders || saveBlocked}
                    onChange={(e) => {
                      void handleFolderSelect(e);
                    }}
                    className="hidden"
                    {...FOLDER_INPUT_ATTRS}
                  />
                  {uploadingFolders ? "Subiendo…" : "Seleccionar carpeta"}
                </label>
              </div>
              {uploadStatus ? (
                <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {uploadStatus}
                </p>
              ) : null}
              {uploadTree === null ? (
                <p className="mt-3 text-xs text-zinc-500">Cargando carpetas…</p>
              ) : uploadTree.length === 0 ? (
                <p className="mt-3 text-xs text-zinc-500">
                  Aún no has subido ninguna carpeta. Las imágenes se guardarán en{" "}
                  <code className="rounded bg-black/5 px-1 text-[11px] dark:bg-white/10">
                    public/images/routines/uploads/&lt;subcarpeta&gt;/
                  </code>
                  .
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {uploadTree.map((entry) => (
                    <div
                      key={entry.folder}
                      className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900/40"
                    >
                      <div className="flex flex-wrap items-baseline gap-2 px-1 pb-2">
                        <span className="font-mono text-xs font-medium text-zinc-800 dark:text-zinc-100">
                          {entry.folder}/
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {entry.files.length} archivo
                          {entry.files.length === 1 ? "" : "s"}
                        </span>
                        {entry.matchesCategory ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                            categoría: {routineCategoryLabel(entry.category)}
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            categoría sugerida: General
                          </span>
                        )}
                      </div>
                      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {entry.files.map((f) => {
                          const selected = gifUrl.trim() === f.url;
                          return (
                            <li key={f.url}>
                              <button
                                type="button"
                                disabled={saving || aiBusy || saveBlocked}
                                onClick={() => pickUploadAsset(entry.folder, f.url)}
                                title={f.name}
                                className={`flex w-full flex-col items-stretch gap-1 rounded-lg border p-1 text-left transition disabled:opacity-50 ${
                                  selected
                                    ? "border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40"
                                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60"
                                }`}
                              >
                                <div className="relative aspect-square overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                                  <img
                                    src={f.url}
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                  {selected ? (
                                    <span className="absolute right-1 top-1 rounded bg-emerald-600 px-1 text-[10px] font-medium text-white">
                                      ✓
                                    </span>
                                  ) : null}
                                </div>
                                <span className="truncate font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                                  {f.name}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
        {previewUrl ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-600 dark:bg-zinc-800/50">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Vista previa</p>
            <div className="relative mt-2 aspect-video w-full max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900">
              <img
                src={previewUrl}
                alt="Vista previa de la rutina"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {editing ? (
            <>
              <button
                type="button"
                disabled={saving || aiBusy || saveBlocked}
                onClick={() => void saveEdit()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Guardar cambios
              </button>
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => resetForm()}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancelar edición
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={saving || aiBusy || saveBlocked}
              onClick={() => void createRoutine()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Crear rutina
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold">Listado</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800/80">
              <tr>
                <th className="px-3 py-2">Imagen</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Ilustración</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {routines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                    {setupHint
                      ? "Cuando la base de datos esté lista, podrás crear rutinas aquí."
                      : "Sin rutinas. Crea la primera arriba."}
                  </td>
                </tr>
              ) : (
                routines.map((r) => (
                  <tr key={r.id} className="bg-white dark:bg-zinc-900/30">
                    <td className="px-3 py-2">
                      <div className="relative h-24 w-40 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
                        <img
                          src={r.gifUrl}
                          alt={r.name}
                          className="h-full w-full object-cover"
                          title={r.gifUrl}
                        />
                      </div>
                    </td>
                    <td className="max-w-[10rem] px-3 py-2 font-medium">{r.name}</td>
                    <td className="max-w-xs px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="line-clamp-2">{r.description}</span>
                    </td>
                    <td
                      className="max-w-[10rem] truncate px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400"
                      title={r.gifUrl}
                    >
                      {galleryLabelForPath(r.gifUrl) ?? presetLabelForPath(r.gifUrl) ?? "IA / URL"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {routineCategoryLabel(normalizeRoutineCategory(r.category))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={saveBlocked}
                        onClick={() => startEdit(r)}
                        className="text-emerald-700 underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-400"
                      >
                        Editar
                      </button>
                      <span className="mx-2 text-zinc-300">|</span>
                      <button
                        type="button"
                        disabled={saveBlocked}
                        onClick={() => void remove(r.id)}
                        className="text-red-600 underline disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
