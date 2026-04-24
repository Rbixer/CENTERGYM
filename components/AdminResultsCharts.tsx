"use client";

import { classifyYesNoOption } from "@/lib/yes-no";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = [
  "#059669",
  "#0d9488",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#c026d3",
  "#db2777",
];

export type QuestionStat = {
  questionId: string;
  text: string;
  total: number;
  options: { optionId: string; text: string; count: number; percent: number }[];
};

export type TrainerSiNoRow = {
  trainerGroupId: string;
  label: string;
  siCount: number;
  noCount: number;
  total: number;
  siPercent: number;
  noPercent: number;
};

export type TrainerStarsRow = {
  trainerGroupId: string;
  label: string;
  avgStars: number;
  count: number;
};

type Props = {
  trainerSiNo: TrainerSiNoRow[];
  trainerStars: TrainerStarsRow[];
  questionStats: QuestionStat[];
  pie: { label: string; value: number }[];
};

export function AdminResultsCharts({
  trainerSiNo,
  trainerStars,
  questionStats,
  pie,
}: Props) {
  const starBarData = trainerStars
    .filter((t) => t.count > 0)
    .map((t) => ({
      label: t.label.length > 22 ? `${t.label.slice(0, 20)}…` : t.label,
      fullLabel: t.label,
      avgStars: t.avgStars,
      count: t.count,
    }));

  function visualStarsFromAvg(avg: number): string {
    const r = Math.min(5, Math.max(0, Math.round(avg)));
    return "★".repeat(r) + "☆".repeat(5 - r);
  }

  const chartData = trainerSiNo.map((t) => ({
    label:
      t.label.length > 22 ? `${t.label.slice(0, 20)}…` : t.label,
    fullLabel: t.label,
    Sí: t.siPercent,
    No: t.noPercent,
    siCount: t.siCount,
    noCount: t.noCount,
    total: t.total,
  }));

  const hasTrainerAnswers = trainerSiNo.some((t) => t.total > 0);

  return (
    <>
      <section>
        <h2 className="text-lg font-semibold">
          Por entrenador: Sí (positivo) vs No (negativo)
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Porcentaje de respuestas Sí y No sobre el total de respuestas clasificadas
          de cada turno / entrenador (todas las preguntas juntas).
        </p>
        <div className="mt-4 h-80 w-full min-w-0">
          {!hasTrainerAnswers ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              Sin respuestas Sí/No para graficar (aún no hay envíos o las preguntas
              no usan opciones Sí y No).
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 56 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zinc-200 dark:stroke-zinc-700"
                />
                <XAxis
                  dataKey="label"
                  interval={0}
                  angle={-22}
                  textAnchor="end"
                  height={72}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value, name, props) => {
                    const p = props.payload as {
                      siCount?: number;
                      noCount?: number;
                      total?: number;
                    };
                    const n = String(name);
                    const count =
                      n === "Sí" ? p.siCount ?? 0 : n === "No" ? p.noCount ?? 0 : 0;
                    return [`${value}% (${count} de ${p.total ?? 0})`, n];
                  }}
                  labelFormatter={(_, items) => {
                    const row = items?.[0]?.payload as { fullLabel?: string };
                    return row?.fullLabel ?? "";
                  }}
                />
                <Legend />
                <Bar
                  dataKey="Sí"
                  name="Sí (positivo)"
                  stackId="yn"
                  fill="#059669"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="No"
                  name="No (negativo)"
                  stackId="yn"
                  fill="#64748b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          Gráfico por entrenador (Sí vs No)
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Cada tarjeta es un envío agrupado por turno: proporción de respuestas
          positivas (Sí) y negativas (No).
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trainerSiNo.map((t) => (
            <div
              key={t.trainerGroupId}
              className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3 dark:border-zinc-700 dark:bg-zinc-900/30"
            >
              <p
                className="mb-2 text-center text-xs font-medium leading-snug text-foreground"
                title={t.label}
              >
                {t.label.length > 40 ? `${t.label.slice(0, 38)}…` : t.label}
              </p>
              {t.total === 0 ? (
                <p className="py-10 text-center text-xs text-zinc-500">
                  Sin respuestas clasificadas
                </p>
              ) : (
                <div className="h-48 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: `Sí ${t.siPercent}%`,
                            value: t.siCount,
                            fill: "#059669",
                          },
                          {
                            name: `No ${t.noPercent}%`,
                            value: t.noCount,
                            fill: "#64748b",
                          },
                        ].filter((d) => d.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={68}
                        paddingAngle={2}
                      />
                      <Tooltip
                        formatter={(value) => [`${value} respuestas`, ""]}
                      />
                      <Legend verticalAlign="bottom" height={32} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          Calificación del entrenador (promedio de estrellas)
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          El <strong className="font-medium text-foreground">promedio de 1 a 5</strong>{" "}
          es la calificación oficial de cada turno / entrenador (solo cuenta
          envíos con estrellas).
        </p>
        {trainerStars.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800/80">
                <tr>
                  <th className="px-3 py-2">Entrenador / turno</th>
                  <th className="px-3 py-2">Calificación</th>
                  <th className="px-3 py-2">Visual</th>
                  <th className="px-3 py-2">Envíos valorados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {trainerStars.map((t) => (
                  <tr key={t.trainerGroupId}>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {t.label}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {t.count === 0 ? "—" : `${t.avgStars.toFixed(1)} / 5`}
                    </td>
                    <td
                      className="px-3 py-2 text-amber-600 tracking-tight dark:text-amber-400"
                      title={
                        t.count === 0
                          ? "Sin valoraciones"
                          : `Calificación promedio: ${t.avgStars}`
                      }
                    >
                      {t.count === 0 ? "—" : visualStarsFromAvg(t.avgStars)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                      {t.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="mt-6 h-72 w-full min-w-0">
          {starBarData.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              Aún no hay valoraciones con estrellas para graficar.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={starBarData}
                margin={{ top: 8, right: 8, left: 0, bottom: 56 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zinc-200 dark:stroke-zinc-700"
                />
                <XAxis
                  dataKey="label"
                  interval={0}
                  angle={-22}
                  textAnchor="end"
                  height={72}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value, _name, item) => {
                    const p = item?.payload as { count?: number };
                    return [
                      `${value} / 5 (calificación) · ${p?.count ?? 0} envío${(p?.count ?? 0) === 1 ? "" : "s"}`,
                      "Estrellas",
                    ];
                  }}
                  labelFormatter={(_, items) => {
                    const row = items?.[0]?.payload as { fullLabel?: string };
                    return row?.fullLabel ?? "";
                  }}
                />
                <Bar
                  dataKey="avgStars"
                  name="Calificación (promedio)"
                  fill="#d97706"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Distribución por pregunta</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Porcentaje por opción respecto al total de envíos que respondieron cada
          pregunta.
        </p>
        <div className="mt-6 space-y-10">
          {questionStats.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No hay preguntas configuradas.
            </p>
          ) : null}
          {questionStats.map((q) => (
            <div
              key={q.questionId}
              className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/30"
            >
              <h3 className="text-sm font-semibold text-foreground">{q.text}</h3>
              <p className="mt-1 text-xs text-zinc-500">
                {q.total} respuesta{q.total === 1 ? "" : "s"}
              </p>
              <ul className="mt-4 space-y-3">
                {q.options.map((o) => {
                  const barClass =
                    classifyYesNoOption(o.text) === "si"
                      ? "bg-emerald-600"
                      : classifyYesNoOption(o.text) === "no"
                        ? "bg-slate-500"
                        : "bg-zinc-500";
                  return (
                    <li key={o.optionId}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                        <span className="min-w-0 flex-1 leading-snug">{o.text}</span>
                        <span className="shrink-0 tabular-nums font-medium text-foreground">
                          {o.percent}%{" "}
                          <span className="font-normal text-zinc-500">
                            ({o.count})
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className={`h-full rounded-full transition-[width] ${barClass}`}
                          style={{ width: `${Math.min(100, o.percent)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Envíos por turno / entrenador</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Cuántos cuestionarios se enviaron por cada opción del desplegable.
        </p>
        <div className="mt-4 h-72 w-full min-w-0">
          {pie.length === 0 || pie.every((p) => p.value === 0) ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              Sin datos para graficar (aún no hay envíos).
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pie}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(props) => {
                    const name = String(props.name ?? "");
                    const pct =
                      typeof props.percent === "number"
                        ? (props.percent * 100).toFixed(0)
                        : "0";
                    return `${name.slice(0, 18)}${name.length > 18 ? "…" : ""} ${pct}%`;
                  }}
                >
                  {pie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </>
  );
}
