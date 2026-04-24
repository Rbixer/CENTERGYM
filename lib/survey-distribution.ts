import type { Answer, Question, QuestionOption, Submission } from "@prisma/client";

type QuestionWithOptions = Question & { options: QuestionOption[] };

type SubmissionWithAnswers = Submission & { answers: Answer[] };

export type OptionDistribution = {
  optionId: string;
  text: string;
  count: number;
  percent: number;
};

export type QuestionDistribution = {
  questionId: string;
  text: string;
  total: number;
  options: OptionDistribution[];
};

/** Porcentajes por opción dentro de cada pregunta (sobre el total de respuestas a esa pregunta). */
export function questionDistributions(
  questions: QuestionWithOptions[],
  submissions: SubmissionWithAnswers[],
): QuestionDistribution[] {
  return questions.map((q) => {
    const counts = new Map<string, number>();
    for (const o of q.options) counts.set(o.id, 0);

    let total = 0;
    for (const s of submissions) {
      const a = s.answers.find((x) => x.questionId === q.id);
      if (!a?.selectedOptionId) continue;
      if (!counts.has(a.selectedOptionId)) continue;
      total += 1;
      const cur = counts.get(a.selectedOptionId) ?? 0;
      counts.set(a.selectedOptionId, cur + 1);
    }

    const options = [...q.options]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((o) => {
        const count = counts.get(o.id) ?? 0;
        const percent =
          total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
        return {
          optionId: o.id,
          text: o.text,
          count,
          percent,
        };
      });

    return {
      questionId: q.id,
      text: q.text,
      total,
      options,
    };
  });
}
