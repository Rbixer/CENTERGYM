import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_TRAINER_COMMENT = 2000;

type Body = {
  trainerGroupId?: string;
  answers?: Record<string, string>;
  /** Algunos clientes envían el número como cadena. */
  trainerRating?: number | string;
  trainerComment?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const trainerGroupId = body.trainerGroupId?.trim();
  if (!trainerGroupId) {
    return NextResponse.json(
      { error: "Debe seleccionar Turno / Entrenador" },
      { status: 400 },
    );
  }

  const trainer = await prisma.trainerGroup.findUnique({
    where: { id: trainerGroupId },
  });
  if (!trainer) {
    return NextResponse.json({ error: "Turno no válido" }, { status: 400 });
  }

  const questions = await prisma.question.findMany({
    orderBy: { sortOrder: "asc" },
    include: { options: true },
  });

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "No hay preguntas configuradas" },
      { status: 400 },
    );
  }

  const answersMap = new Map<string, string>();
  for (const q of questions) {
    const oid = body.answers?.[q.id];
    if (!oid || typeof oid !== "string") {
      return NextResponse.json(
        { error: `Falta respuesta: "${q.text.slice(0, 60)}…"` },
        { status: 400 },
      );
    }
    const valid = q.options.some((o) => o.id === oid);
    if (!valid) {
      return NextResponse.json(
        { error: "Opción de respuesta no válida" },
        { status: 400 },
      );
    }
    answersMap.set(q.id, oid);
  }

  const rawRating = body.trainerRating;
  let trainerRating: number | null = null;
  if (typeof rawRating === "number" && Number.isFinite(rawRating)) {
    const r = Math.round(rawRating);
    if (r >= 1 && r <= 5 && Math.abs(rawRating - r) < 1e-9) {
      trainerRating = r;
    }
  } else if (typeof rawRating === "string" && rawRating.trim() !== "") {
    const n = Number(rawRating.trim().replace(",", "."));
    if (Number.isFinite(n)) {
      const r = Math.round(n);
      if (r >= 1 && r <= 5 && Math.abs(n - r) < 1e-9) {
        trainerRating = r;
      }
    }
  }
  if (trainerRating === null || trainerRating < 1 || trainerRating > 5) {
    return NextResponse.json(
      { error: "Indica una valoración del entrenador de 1 a 5 estrellas" },
      { status: 400 },
    );
  }

  let trainerComment: string | null = null;
  if (body.trainerComment !== undefined && body.trainerComment !== null) {
    if (typeof body.trainerComment !== "string") {
      return NextResponse.json(
        { error: "El comentario debe ser texto" },
        { status: 400 },
      );
    }
    const trimmed = body.trainerComment.trim();
    if (trimmed.length > MAX_TRAINER_COMMENT) {
      return NextResponse.json(
        {
          error: `El comentario no puede superar ${MAX_TRAINER_COMMENT} caracteres`,
        },
        { status: 400 },
      );
    }
    trainerComment = trimmed.length > 0 ? trimmed : null;
  }

  const submittedAt = new Date();

  try {
    const submission = await prisma.submission.create({
      data: {
        trainerGroupId,
        submittedAt,
        trainerRating,
        trainerComment,
        answers: {
          create: questions.map((q) => ({
            questionId: q.id,
            selectedOptionId: answersMap.get(q.id)!,
          })),
        },
      },
    });

    return NextResponse.json({
      id: submission.id,
      submittedAt: submission.submittedAt.toISOString(),
    });
  } catch (err) {
    console.error("[submit]", err);

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2003") {
        return NextResponse.json(
          {
            error:
              "Algún dato ya no es válido (por ejemplo, el cuestionario cambió). Recarga la página e inténtalo de nuevo.",
          },
          { status: 400 },
        );
      }
    }

    let msg =
      err instanceof Error ? err.message : "Error al guardar el envío";

    if (err instanceof Prisma.PrismaClientValidationError) {
      if (
        msg.includes("Unknown argument") &&
        (msg.includes("trainerRating") || msg.includes("trainerComment"))
      ) {
        msg =
          "El servidor sigue usando un cliente Prisma antiguo (no reconoce la valoración). Detén por completo `npm run dev`, ejecuta `npx prisma generate` y `npx prisma db push`, y vuelve a arrancar.";
      }
    }

    if (
      typeof msg === "string" &&
      (msg.includes("SQLITE_BUSY") || msg.includes("database is locked"))
    ) {
      msg =
        "La base de datos estaba ocupada. Espera unos segundos y vuelve a enviar.";
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Error del servidor: ${msg}`
            : "No se pudo guardar. Comprueba que la base de datos esté actualizada (npx prisma db push) y reinicia el servidor.",
      },
      { status: 500 },
    );
  }
}
