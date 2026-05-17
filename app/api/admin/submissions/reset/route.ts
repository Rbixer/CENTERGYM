import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { clearSurveyRateLimits } from "@/lib/survey-rate-limit";

export const runtime = "nodejs";

/** PIN requerido para borrar todos los registros de encuesta. */
const SURVEY_RESET_PIN = "2000";

/**
 * Borra todos los envíos de encuesta, sus respuestas y los códigos de
 * recompensa ligados (`survey_reward`). Las preguntas y turnos no se tocan.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { pin?: unknown };
  try {
    body = (await req.json()) as { pin?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const pin = String(body.pin ?? "").trim();
  if (pin !== SURVEY_RESET_PIN) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 403 });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const promoCodes = await tx.promoCode.deleteMany({
      where: { kind: "survey_reward" },
    });
    const submissions = await tx.submission.deleteMany({});
    return {
      submissions: submissions.count,
      promoCodes: promoCodes.count,
    };
  });

  clearSurveyRateLimits();

  return NextResponse.json({
    ok: true,
    deleted,
  });
}
