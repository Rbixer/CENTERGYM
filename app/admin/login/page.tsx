"use client";

import { GymCenterLogo } from "@/components/GymCenterLogo";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 20000);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "same-origin",
        signal: ac.signal,
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Error al iniciar sesión");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      const aborted =
        err instanceof DOMException
          ? err.name === "AbortError"
          : err instanceof Error && err.name === "AbortError";
      setError(
        aborted
          ? "El servidor no respondió a tiempo. Reinicia el servidor (npm run dev:fresh) o vuelve a intentar."
          : "No se pudo conectar. Usa exactamente la misma dirección y puerto que para la encuesta (no mezcles localhost, 127.0.0.1 y la IP de la red).",
      );
    } finally {
      window.clearTimeout(t);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-1 flex-col justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:py-16">
      <div className="flex justify-center">
        <GymCenterLogo className="max-h-28 w-auto max-w-[260px] object-contain" />
      </div>
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        Introduce la clave configurada en{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
          ADMIN_PASSWORD
        </code>
        .
      </p>
      <p className="mt-3 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
        Usa el <strong>mismo host y puerto</strong> que la encuesta (p. ej. si abres
        la encuesta con la IP del PC, el admin debe ser esa misma IP, no{" "}
        <code className="rounded bg-zinc-100 px-0.5 text-[11px] dark:bg-zinc-800">
          localhost
        </code>
        ). Puerto por defecto:{" "}
        <code className="rounded bg-zinc-100 px-0.5 text-[11px] dark:bg-zinc-800">
          4178
        </code>
        .
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm font-medium text-foreground">
          Clave
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 min-h-[48px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-foreground shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="min-h-[48px] w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-medium text-white transition active:bg-emerald-800 hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
