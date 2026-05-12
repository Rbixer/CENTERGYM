"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatGtq, parseQuetzalesToCents } from "@/lib/money";
import { parseResponseJson } from "@/lib/parse-response-json";
import { useToast } from "@/components/ToastProvider";

type PromoCode = {
  id: string;
  code: string;
  description: string;
  kind: string;
  discountType: "percent" | "fixed" | "free" | string;
  discountValue: number;
  minSubtotalCents: number | null;
  maxUses: number | null;
  uses: number;
  maxUsesPerUser: number | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  isPublic: boolean;
  createdAt: string;
  redemptionsCount: number;
  totalSavedCents: number;
};

function kindLabel(k: string): string {
  switch (k) {
    case "store":
      return "Tienda";
    case "survey_reward":
      return "Recompensa encuesta";
    case "day_pass":
      return "Pase de día";
    case "membership":
      return "Mensualidad";
    case "referral":
      return "Referido";
    default:
      return k;
  }
}

function discountText(p: PromoCode): string {
  if (p.discountType === "percent") return `${p.discountValue}% off`;
  if (p.discountType === "fixed") return `${formatGtq(p.discountValue)} off`;
  return "Gratis";
}

function statusBadge(p: PromoCode): { label: string; cls: string } {
  if (!p.active) return { label: "Inactivo", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" };
  const now = new Date();
  if (p.validUntil && new Date(p.validUntil) < now) {
    return { label: "Caducado", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" };
  }
  if (p.validFrom && new Date(p.validFrom) > now) {
    return { label: "Pendiente", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200" };
  }
  if (p.maxUses != null && p.uses >= p.maxUses) {
    return { label: "Agotado", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" };
  }
  return { label: "Activo", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" };
}

export function AdminPromosPanel() {
  const router = useRouter();
  const { toast } = useToast();

  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDiscountType, setNewDiscountType] = useState<"percent" | "fixed" | "free">("percent");
  const [newDiscountValue, setNewDiscountValue] = useState("");
  const [newMinSubtotal, setNewMinSubtotal] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [newValidUntil, setNewValidUntil] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/admin/promo-codes", { credentials: "include" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const p = await parseResponseJson<{ codes?: PromoCode[]; error?: string }>(res);
    if (p.parseError || !p.ok || !p.body) {
      setLoadError(p.body?.error ?? p.parseError ?? "Error al listar códigos");
      return;
    }
    setCodes(p.body.codes ?? []);
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === "all") return codes;
    if (filter === "active") return codes.filter((c) => c.active);
    return codes.filter((c) => !c.active);
  }, [codes, filter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        kind: "store",
        description: newDescription,
        discountType: newDiscountType,
        autoGenerate,
        isPublic: newIsPublic,
      };
      if (!autoGenerate) body.code = newCode;

      if (newDiscountType === "percent") {
        const v = Math.floor(Number(newDiscountValue));
        if (!Number.isFinite(v) || v < 1 || v > 100) {
          toast("El porcentaje debe estar entre 1 y 100", "error");
          setSaving(false);
          return;
        }
        body.discountValue = v;
      } else if (newDiscountType === "fixed") {
        const cents = parseQuetzalesToCents(newDiscountValue);
        if (cents == null || cents < 1) {
          toast("Indica un monto fijo válido en quetzales", "error");
          setSaving(false);
          return;
        }
        body.discountValue = cents;
      } else {
        body.discountValue = 0;
      }

      if (newMinSubtotal.trim()) {
        const cents = parseQuetzalesToCents(newMinSubtotal);
        if (cents != null && cents > 0) body.minSubtotalCents = cents;
      }
      if (newMaxUses.trim()) {
        const n = Math.floor(Number(newMaxUses));
        if (Number.isFinite(n) && n > 0) body.maxUses = n;
      }
      if (newValidUntil.trim()) {
        body.validUntil = new Date(newValidUntil).toISOString();
      }

      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const p = await parseResponseJson<{ code?: PromoCode; error?: string }>(res);
      if (p.parseError || !p.ok || !p.body) {
        toast(p.body?.error ?? p.parseError ?? "Error al crear código", "error");
        return;
      }
      toast(`Código «${p.body.code?.code}» creado.`, "success");
      setNewCode("");
      setNewDescription("");
      setNewDiscountValue("");
      setNewMinSubtotal("");
      setNewMaxUses("");
      setNewValidUntil("");
      setAutoGenerate(false);
      setNewIsPublic(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: PromoCode) {
    const res = await fetch(`/api/admin/promo-codes/${c.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    const p = await parseResponseJson<{ code?: PromoCode; error?: string }>(res);
    if (p.parseError || !p.ok) {
      toast(p.body?.error ?? p.parseError ?? "Error", "error");
      return;
    }
    toast(`Código «${c.code}» ${!c.active ? "activado" : "desactivado"}.`, "success");
    await refresh();
  }

  async function togglePublic(c: PromoCode) {
    const res = await fetch(`/api/admin/promo-codes/${c.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublic: !c.isPublic }),
    });
    const p = await parseResponseJson<{ code?: PromoCode; error?: string }>(res);
    if (p.parseError || !p.ok) {
      toast(p.body?.error ?? p.parseError ?? "Error", "error");
      return;
    }
    toast(
      !c.isPublic
        ? `«${c.code}» ahora se muestra a todos los clientes.`
        : `«${c.code}» dejó de mostrarse en /promos.`,
      "success",
    );
    await refresh();
  }

  async function removeCode(c: PromoCode) {
    if (!confirm(`¿Borrar el código «${c.code}»?`)) return;
    const res = await fetch(`/api/admin/promo-codes/${c.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const p = await parseResponseJson<{ deactivated?: boolean; message?: string; error?: string }>(res);
    if (p.parseError || !p.ok) {
      toast(p.body?.error ?? p.parseError ?? "Error", "error");
      return;
    }
    if (p.body?.deactivated) {
      toast(p.body.message ?? "Desactivado", "info");
    } else {
      toast("Código borrado.", "success");
    }
    await refresh();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copiado al portapapeles.", "success");
    } catch {
      toast("No se pudo copiar.", "error");
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Códigos de promoción</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Crea códigos para descuentos en la <strong>tienda</strong>. Cuando un alumno completa la
          encuesta también recibe automáticamente un código personal de recompensa (no se gestionan
          desde aquí, se listan abajo como tipo «Recompensa encuesta»).
        </p>
      </header>

      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3 className="text-sm font-semibold">Crear código nuevo</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Código
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="VERANO20"
                disabled={autoGenerate}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm uppercase disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:disabled:bg-zinc-900"
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={autoGenerate}
                  onChange={(e) => setAutoGenerate(e.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
                Auto-generar
              </label>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Descripción interna
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Promo lanzamiento verano 2026"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Tipo de descuento
            </label>
            <select
              value={newDiscountType}
              onChange={(e) => setNewDiscountType(e.target.value as "percent" | "fixed" | "free")}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="percent">Porcentaje (%)</option>
              <option value="fixed">Monto fijo (Q)</option>
              <option value="free">Gratis (100%)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {newDiscountType === "percent"
                ? "Porcentaje (1-100)"
                : newDiscountType === "fixed"
                ? "Monto en Q"
                : "—"}
            </label>
            <input
              type="text"
              value={newDiscountValue}
              onChange={(e) => setNewDiscountValue(e.target.value)}
              disabled={newDiscountType === "free"}
              placeholder={newDiscountType === "percent" ? "20" : "50"}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:disabled:bg-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Mínimo de compra (Q, opcional)
            </label>
            <input
              type="text"
              value={newMinSubtotal}
              onChange={(e) => setNewMinSubtotal(e.target.value)}
              placeholder="100"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Usos totales (opcional)
            </label>
            <input
              type="number"
              min={1}
              value={newMaxUses}
              onChange={(e) => setNewMaxUses(e.target.value)}
              placeholder="Ilimitado"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Fecha de expiración (opcional)
            </label>
            <input
              type="date"
              value={newValidUntil}
              onChange={(e) => setNewValidUntil(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-950/30">
              <input
                type="checkbox"
                checked={newIsPublic}
                onChange={(e) => setNewIsPublic(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600"
              />
              <span className="text-amber-900 dark:text-amber-100">
                <strong className="block">Mostrar a todos los clientes</strong>
                <span className="text-amber-800/80 dark:text-amber-200/70">
                  Aparece en la página <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">/promos</code> y
                  se anuncia con un botón en la home. Déjalo desmarcado si vas a repartir el código por WhatsApp o redes.
                </span>
              </span>
            </label>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "Creando…" : "Crear código"}
          </button>
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">
            Códigos existentes{" "}
            <span className="ml-1 text-xs font-normal text-zinc-500">({codes.length})</span>
          </h3>
          <div className="flex gap-1 text-xs">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={
                  filter === f
                    ? "rounded-full border border-emerald-500 bg-emerald-600 px-2.5 py-1 font-medium text-white"
                    : "rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                }
              >
                {f === "all" ? "Todos" : f === "active" ? "Activos" : "Inactivos"}
              </button>
            ))}
          </div>
        </div>

        {loadError ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{loadError}</p>
        ) : null}

        {filtered.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No hay códigos {filter !== "all" ? "para ese filtro" : "todavía"}.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {filtered.map((c) => {
              const badge = statusBadge(c);
              return (
                <li
                  key={c.id}
                  className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded-md bg-amber-100 px-2 py-1 text-base font-bold tracking-wider text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                          {c.code}
                        </code>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {kindLabel(c.kind)}
                        </span>
                        {c.isPublic ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                            👁 Visible
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-medium">
                        {discountText(c)}
                        {c.minSubtotalCents
                          ? ` · mínimo ${formatGtq(c.minSubtotalCents)}`
                          : ""}
                      </p>
                      {c.description ? (
                        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{c.description}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Usos: <strong>{c.uses}</strong>
                        {c.maxUses != null ? ` / ${c.maxUses}` : " (sin tope)"} · Ahorro acumulado:{" "}
                        <strong>{formatGtq(c.totalSavedCents)}</strong>
                        {c.validUntil
                          ? ` · vence ${new Date(c.validUntil).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => void copy(c.code)}
                        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      >
                        Copiar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void copy(`${window.location.origin}/tienda?promo=${c.code}`)
                        }
                        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      >
                        Copiar link
                      </button>
                      <button
                        type="button"
                        onClick={() => void togglePublic(c)}
                        title={c.isPublic ? "Quitar de /promos" : "Mostrar en /promos"}
                        className={
                          c.isPublic
                            ? "rounded-lg border border-amber-400 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-100"
                            : "rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        }
                      >
                        {c.isPublic ? "👁 Visible" : "👁 Oculto"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(c)}
                        className={
                          c.active
                            ? "rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                            : "rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                        }
                      >
                        {c.active ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeCode(c)}
                        className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
