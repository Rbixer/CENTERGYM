import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const questions = await prisma.question.findMany({
    orderBy: { sortOrder: "asc" },
    include: { options: true },
  });

  const submissions = await prisma.submission.findMany({
    orderBy: { submittedAt: "desc" },
    include: {
      trainerGroup: true,
      answers: {
        include: { selectedOption: true },
      },
    },
  });

  const qHeaders = questions.map((_, i) => `Pregunta_${i + 1}_respuesta`);

  const header = [
    "id_envio",
    "fecha_hora_utc",
    "turno_entrenador",
    "calificacion_estrellas_1_a_5",
    "comentario_entrenador",
    "num_respuestas",
    ...qHeaders,
  ];

  const lines: string[] = [header.map(csvEscape).join(",")];

  for (const s of submissions) {
    const answerTexts: string[] = [];

    for (const q of questions) {
      const ans = s.answers.find((a) => a.questionId === q.id);
      answerTexts.push(ans?.selectedOption?.text ?? "");
    }

    const row = [
      s.id,
      s.submittedAt.toISOString(),
      s.trainerGroup.label,
      s.trainerRating != null ? String(s.trainerRating) : "",
      s.trainerComment ?? "",
      String(s.answers.length),
      ...answerTexts,
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  const csv = "\uFEFF" + lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resultados_encuesta.csv"`,
    },
  });
}
