import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const questionCount = await prisma.question.count();

  const submissions = await prisma.submission.findMany({
    orderBy: { submittedAt: "desc" },
    include: {
      trainerGroup: true,
      answers: true,
    },
  });

  const rows = submissions.map((s) => ({
    id: s.id,
    submittedAt: s.submittedAt.toISOString(),
    trainerLabel: s.trainerGroup.label,
    trainerGroupId: s.trainerGroupId,
    trainerRating: s.trainerRating,
    trainerComment: s.trainerComment,
    answersCount: s.answers.length,
    questionCount,
  }));

  return NextResponse.json({ submissions: rows });
}
