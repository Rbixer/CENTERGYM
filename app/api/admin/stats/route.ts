import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { questionDistributions } from "@/lib/survey-distribution";
import { classifyYesNoOption } from "@/lib/yes-no";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const questions = await prisma.question.findMany({
      orderBy: { sortOrder: "asc" },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });

    const submissions = await prisma.submission.findMany({
      include: {
        trainerGroup: true,
        answers: { include: { selectedOption: true } },
      },
    });

    const byTrainer = new Map<
      string,
      { label: string; value: number; si: number; no: number }
    >();
    for (const s of submissions) {
      const key = s.trainerGroupId;
      const cur = byTrainer.get(key) ?? {
        label: s.trainerGroup.label,
        value: 0,
        si: 0,
        no: 0,
      };
      cur.value += 1;
      for (const a of s.answers) {
        const text = a.selectedOption?.text;
        if (text == null) continue;
        const kind = classifyYesNoOption(text);
        if (kind === "si") cur.si += 1;
        else if (kind === "no") cur.no += 1;
      }
      byTrainer.set(key, cur);
    }

    const pie = [...byTrainer.values()].map(({ label, value }) => ({
      label,
      value,
    }));

    const trainerSiNo = [...byTrainer.entries()]
      .map(([trainerGroupId, v]) => {
        const total = v.si + v.no;
        const siPercent =
          total > 0 ? Math.round((v.si / total) * 1000) / 10 : 0;
        const noPercent =
          total > 0 ? Math.round((v.no / total) * 1000) / 10 : 0;
        return {
          trainerGroupId,
          label: v.label,
          siCount: v.si,
          noCount: v.no,
          total,
          siPercent,
          noPercent,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "es"));

    const questionStats = questionDistributions(questions, submissions);

    const starAgg = new Map<
      string,
      { label: string; sum: number; n: number }
    >();
    for (const s of submissions) {
      if (s.trainerRating == null) continue;
      const key = s.trainerGroupId;
      const cur = starAgg.get(key) ?? {
        label: s.trainerGroup.label,
        sum: 0,
        n: 0,
      };
      cur.sum += s.trainerRating;
      cur.n += 1;
      starAgg.set(key, cur);
    }

    const allTrainers = await prisma.trainerGroup.findMany({
      orderBy: { sortOrder: "asc" },
    });
    const trainerStars = allTrainers.map((tg) => {
      const agg = starAgg.get(tg.id);
      if (!agg || agg.n === 0) {
        return {
          trainerGroupId: tg.id,
          label: tg.label,
          avgStars: 0,
          count: 0,
        };
      }
      return {
        trainerGroupId: tg.id,
        label: tg.label,
        avgStars: Math.round((agg.sum / agg.n) * 10) / 10,
        count: agg.n,
      };
    });

    return NextResponse.json({
      questionStats,
      pie,
      trainerSiNo,
      trainerStars,
      totals: { submissions: submissions.length },
    });
  } catch (e) {
    console.error("admin/stats", e);
    return NextResponse.json(
      { error: "Error al calcular estadísticas" },
      { status: 500 },
    );
  }
}
