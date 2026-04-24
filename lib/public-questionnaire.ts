import { prisma } from "@/lib/prisma";
import { orderYesNoOptions } from "@/lib/yes-no";
import type { PublicQuestion, PublicTrainer } from "./public-questionnaire-types";

export type { PublicQuestion, PublicTrainer } from "./public-questionnaire-types";

export async function getPublicQuestionnaire(): Promise<{
  trainers: PublicTrainer[];
  questions: PublicQuestion[];
}> {
  const [trainers, questions] = await Promise.all([
    prisma.trainerGroup.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true },
    }),
    prisma.question.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        text: true,
        options: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, text: true },
        },
      },
    }),
  ]);

  const questionsOrdered: PublicQuestion[] = questions.map((q) => ({
    ...q,
    options: orderYesNoOptions(q.options),
  }));

  return { trainers, questions: questionsOrdered };
}
