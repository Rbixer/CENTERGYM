import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  attachSurveyDoneCookie,
  createSurveyDoneToken,
  SURVEY_DONE_COOKIE,
  verifySurveyDoneToken,
} from "@/lib/survey-cookie";
import { verifySurveyFormToken } from "@/lib/survey-form-token";
import {
  checkSurveyRateLimit,
  getClientIp,
  hashIpForStorage,
} from "@/lib/survey-rate-limit";

const MAX_TRAINER_COMMENT = 2000;
const MAX_REQUEST_ID = 80;

type Body = {
  trainerGroupId?: string;
  answers?: Record<string, string>;
  /** Algunos clientes envían el número como cadena. */
  trainerRating?: number | string;
  trainerComment?: string;
  /** UUID generado por el cliente para idempotencia. */
  requestId?: string;
  /** Token firmado emitido al renderizar /encuesta. */
  formToken?: string;
  /** Honeypot: si viene con valor → bot, descartamos silenciosamente. */
  hpUrl?: string;
};

/**
 * Respuesta "neutra" para bots: parece OK pero no guarda nada. Así no avisamos
 * al atacante que detectamos el honeypot.
 */
function fakeAcceptedResponse() {
  return NextResponse.json({
    id: "ok",
    submittedAt: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // 1. Honeypot: campo invisible que humanos nunca rellenan.
  if (typeof body.hpUrl === "string" && body.hpUrl.trim() !== "") {
    return fakeAcceptedResponse();
  }

  // 2. Cookie "ya enviaste": disuasor por dispositivo (no infalible, pero corta
  //    el caso "doy click 50 veces seguidas en mi propio móvil/PC").
  const cookieHeader = req.headers.get("cookie") ?? "";
  const surveyDoneRaw = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SURVEY_DONE_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");
  if (verifySurveyDoneToken(surveyDoneRaw)) {
    return NextResponse.json(
      {
        error:
          "Ya enviaste la encuesta desde este dispositivo. Inténtalo de nuevo más tarde.",
      },
      { status: 409 },
    );
  }

  // 3. Form token: rechaza POST directos sin haber abierto la página, envíos
  //    sospechosamente rápidos (< 2s) o con token expirado (> 6h).
  const tokenCheck = verifySurveyFormToken(body.formToken);
  if (!tokenCheck.ok) {
    if (tokenCheck.reason === "too_fast") {
      // muy probablemente bot → respuesta neutra
      return fakeAcceptedResponse();
    }
    if (tokenCheck.reason === "expired") {
      return NextResponse.json(
        {
          error:
            "La sesión de la encuesta caducó. Recarga la página e intenta de nuevo.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Solicitud no válida. Recarga la página e intenta de nuevo." },
      { status: 400 },
    );
  }

  // 4. Rate-limit por IP (5 / 10 min y 30 / día).
  const ip = getClientIp(req);
  const rl = checkSurveyRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:
          rl.reason === "short"
            ? "Has enviado varias encuestas en poco tiempo desde esta red. Espera unos minutos."
            : "Se alcanzó el máximo de envíos diarios desde esta red. Inténtalo mañana.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      },
    );
  }

  // 5. Validación de campos del formulario (igual que antes).
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

  // 6. Idempotencia: si ya existe un Submission con este `requestId`, devolvemos
  //    el mismo. Resuelve doble-click, reintentos por red flaky, etc.
  let requestId: string | null = null;
  if (typeof body.requestId === "string") {
    const trimmed = body.requestId.trim();
    if (trimmed.length > 0 && trimmed.length <= MAX_REQUEST_ID) {
      requestId = trimmed;
    }
  }

  if (requestId) {
    const existing = await prisma.submission.findUnique({
      where: { requestId },
      select: { id: true, submittedAt: true },
    });
    if (existing) {
      const res = NextResponse.json({
        id: existing.id,
        submittedAt: existing.submittedAt.toISOString(),
      });
      attachSurveyDoneCookie(res, createSurveyDoneToken());
      return res;
    }
  }

  const ipHash = hashIpForStorage(ip);
  const submittedAt = new Date();

  try {
    const submission = await prisma.submission.create({
      data: {
        trainerGroupId,
        submittedAt,
        trainerRating,
        trainerComment,
        requestId,
        ipHash,
        answers: {
          create: questions.map((q) => ({
            questionId: q.id,
            selectedOptionId: answersMap.get(q.id)!,
          })),
        },
      },
    });

    const res = NextResponse.json({
      id: submission.id,
      submittedAt: submission.submittedAt.toISOString(),
    });
    attachSurveyDoneCookie(res, createSurveyDoneToken());
    return res;
  } catch (err) {
    console.error("[submit]", err);

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: requestId duplicado por carrera → idempotencia (devolvemos el original).
      if (err.code === "P2002" && requestId) {
        const existing = await prisma.submission.findUnique({
          where: { requestId },
          select: { id: true, submittedAt: true },
        });
        if (existing) {
          const res = NextResponse.json({
            id: existing.id,
            submittedAt: existing.submittedAt.toISOString(),
          });
          attachSurveyDoneCookie(res, createSurveyDoneToken());
          return res;
        }
      }
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
        (msg.includes("trainerRating") ||
          msg.includes("trainerComment") ||
          msg.includes("requestId") ||
          msg.includes("ipHash"))
      ) {
        msg =
          "El servidor sigue usando un cliente Prisma antiguo. Detén `npm run start`, ejecuta `npx prisma generate` y `npx prisma db push`, y vuelve a arrancar.";
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
