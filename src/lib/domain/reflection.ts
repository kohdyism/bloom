import { z } from "zod";

/** Post-lesson reflection (spec §24): clearly anchored 1–5 scales + optional free text. */
export const REFLECTION_RATINGS = [
  { key: "comfort", question: "How comfortable did you feel contributing today?", low: "Not comfortable", high: "Very comfortable" },
  { key: "opportunity", question: "Did you get the chance to take part?", low: "Hardly any chance", high: "Plenty of chances" },
  { key: "listened", question: "Did your group listen to your ideas?", low: "Not really", high: "Yes, really listened" },
  { key: "clarity", question: "How clear were the activity instructions?", low: "Very unclear", high: "Very clear" },
  { key: "ai_helpful", question: "How helpful were Bloom and Pip (the AI helpers)?", low: "Not helpful", high: "Very helpful", allowNa: true },
  { key: "overall", question: "Overall, how did working together go?", low: "Not well", high: "Really well" },
] as const;

export const REFLECTION_QUESTIONS = [
  { key: "helped", question: "What helped you participate today?" },
  { key: "challenging", question: "What was challenging?" },
  { key: "easier", question: "What could make group work easier next time?" },
] as const;

export const SCALE_LABELS = ["1", "2", "3", "4", "5"];

const key = z.string().min(1).max(40).regex(/^[a-z0-9_]+$/);

/**
 * A lesson's own reflection questions, set by the teacher: 1–5 scales and
 * written answers, about the group work or the task itself ("How well did you
 * understand the poem?"). Lessons without their own set use the defaults.
 */
export const reflectionRatingSchema = z.object({
  key,
  question: z.string().min(1).max(200),
  low: z.string().max(40).default("Not at all"),
  high: z.string().max(40).default("Very much"),
  optional: z.boolean().default(false),
});
export const reflectionTextSchema = z.object({ key, question: z.string().min(1).max(200) });
export const reflectionSetSchema = z.object({
  ratings: z.array(reflectionRatingSchema).max(10),
  questions: z.array(reflectionTextSchema).max(6),
});
export type ReflectionRating = z.infer<typeof reflectionRatingSchema>;
export type ReflectionSet = z.infer<typeof reflectionSetSchema>;

export const DEFAULT_REFLECTION: ReflectionSet = {
  ratings: REFLECTION_RATINGS.map((r) => ({ key: r.key, question: r.question, low: r.low, high: r.high, optional: "allowNa" in r && !!r.allowNa })),
  questions: REFLECTION_QUESTIONS.map((q) => ({ key: q.key, question: q.question })),
};

/** The questions for a lesson: the teacher's own set, or the defaults. */
export function reflectionFor(config: { reflection?: ReflectionSet | null } | null | undefined): ReflectionSet {
  const set = config?.reflection;
  return set && (set.ratings.length || set.questions.length) ? set : DEFAULT_REFLECTION;
}

/** What a student sends: answers keyed by question. Checked against the lesson's set on the server. */
export const reflectionSubmitSchema = z.object({
  ratings: z.record(z.string().max(40), z.number().int().min(0).max(5)),
  answers: z.record(z.string().max(40), z.string().max(1000)),
});

/** Keep only answers to this lesson's questions; every non-optional scale must be answered. */
export function cleanReflection(set: ReflectionSet, ratings: Record<string, number>, answers: Record<string, string>) {
  const r: Record<string, number> = {};
  for (const q of set.ratings) {
    const v = ratings[q.key];
    if (typeof v === "number" && v >= 1 && v <= 5) r[q.key] = v;
    else if (q.optional) r[q.key] = 0;
    else return { error: "Please answer each rating question (the optional ones can be skipped)." } as const;
  }
  const a: Record<string, string> = {};
  for (const q of set.questions) {
    const t = answers[q.key]?.trim();
    if (t) a[q.key] = t.slice(0, 1000);
  }
  return { ratings: r, answers: a } as const;
}

/** A tidy key for a new teacher-written question. */
export function newQuestionKey(existing: string[]): string {
  for (let i = 1; i < 100; i++) {
    const k = `q${i}`;
    if (!existing.includes(k)) return k;
  }
  return `q${Date.now() % 100000}`;
}
