import { z } from "zod";

/** Post-lesson reflection (spec §24): clearly anchored 1–5 scales + optional free text. */
export const REFLECTION_RATINGS = [
  { key: "comfort", question: "How comfortable did you feel contributing today?", low: "Not comfortable", high: "Very comfortable" },
  { key: "opportunity", question: "Did you get the chance to take part?", low: "Hardly any chance", high: "Plenty of chances" },
  { key: "listened", question: "Did your group listen to your ideas?", low: "Not really", high: "Yes, really listened" },
  { key: "clarity", question: "How clear were the activity instructions?", low: "Very unclear", high: "Very clear" },
  { key: "ai_helpful", question: "How helpful was Sprout (the AI helper)?", low: "Not helpful", high: "Very helpful", allowNa: true },
  { key: "overall", question: "Overall, how did working together go?", low: "Not well", high: "Really well" },
] as const;

export const REFLECTION_QUESTIONS = [
  { key: "helped", question: "What helped you participate today?" },
  { key: "challenging", question: "What was challenging?" },
  { key: "easier", question: "What could make group work easier next time?" },
] as const;

export const SCALE_LABELS = ["1", "2", "3", "4", "5"];

export const reflectionSchema = z.object({
  ratings: z.object(
    Object.fromEntries(REFLECTION_RATINGS.map((r) => [r.key, z.number().int().min(0).max(5)])) as Record<(typeof REFLECTION_RATINGS)[number]["key"], z.ZodNumber>,
  ),
  answers: z.object(
    Object.fromEntries(REFLECTION_QUESTIONS.map((q) => [q.key, z.string().max(1000).optional()])) as Record<(typeof REFLECTION_QUESTIONS)[number]["key"], z.ZodOptional<z.ZodString>>,
  ),
});
