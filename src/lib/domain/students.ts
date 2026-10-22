import { z } from "zod";

/** Functional, non-diagnostic accommodations a teacher can switch on (spec §7). */
export const ACCOMMODATIONS = {
  smaller_groups: { label: "Benefits from smaller groups", short: "Smaller groups" },
  extra_processing_time: { label: "Needs additional processing time", short: "Extra thinking time" },
  written_instructions: { label: "Prefers written instructions", short: "Written instructions" },
  explicit_turn_taking: { label: "Benefits from explicit turn-taking structure", short: "Clear turn-taking" },
  reduced_sensory: { label: "Requires reduced sensory stimulation", short: "Calmer display" },
  task_breakdown: { label: "Benefits from task breakdowns", short: "Step-by-step tasks" },
} as const;
export type AccommodationKind = keyof typeof ACCOMMODATIONS;
export const ACCOMMODATION_KINDS = Object.keys(ACCOMMODATIONS) as AccommodationKind[];

/** Working-preferences survey (spec §7). No diagnosis questions; no "who do you dislike". */
export const SURVEY_QUESTIONS = [
  {
    key: "communication",
    question: "When you share an idea with a group, what usually feels easiest?",
    options: [
      { value: "talk", label: "Saying it out loud" },
      { value: "write", label: "Writing it down first" },
      { value: "mix", label: "A mix — it depends" },
    ],
  },
  {
    key: "written",
    question: "Which do you feel more comfortable with in group work?",
    options: [
      { value: "spoken", label: "Spoken discussion" },
      { value: "written", label: "Written messages and notes" },
      { value: "both", label: "Both are fine" },
    ],
  },
  {
    key: "structure",
    question: "Do you prefer activities that are…",
    options: [
      { value: "structured", label: "Clearly structured, step by step" },
      { value: "open", label: "Open-ended, with room to explore" },
    ],
  },
  {
    key: "examples",
    question: "Do examples help you get started?",
    options: [
      { value: "yes", label: "Yes, usually" },
      { value: "sometimes", label: "Sometimes" },
      { value: "no", label: "Not really" },
    ],
  },
  {
    key: "reminders",
    question: "Are gentle reminders (like 'two minutes left') helpful?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "sometimes", label: "Sometimes" },
      { value: "no", label: "I'd rather not" },
    ],
  },
  {
    key: "visuals",
    question: "Do pictures, diagrams or visual explanations help you?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "sometimes", label: "Sometimes" },
      { value: "no", label: "Not much" },
    ],
  },
  {
    key: "thinkingTime",
    question: "Do you like some quiet thinking time before discussing?",
    options: [
      { value: "yes", label: "Yes, it helps a lot" },
      { value: "sometimes", label: "Sometimes" },
      { value: "no", label: "I'm happy to jump in" },
    ],
  },
  {
    key: "workingStyle",
    question: "Which way of working do you usually enjoy most?",
    options: [
      { value: "solo_first", label: "On my own first, then together" },
      { value: "pairs", label: "In pairs" },
      { value: "small_group", label: "In a small group" },
      { value: "larger_group", label: "In a bigger group" },
    ],
  },
] as const;

export type SurveyKey = (typeof SURVEY_QUESTIONS)[number]["key"];

export const surveySchema = z.object(
  Object.fromEntries(
    SURVEY_QUESTIONS.map((q) => [q.key, z.enum(q.options.map((o) => o.value) as [string, ...string[]]).optional()]),
  ) as Record<SurveyKey, z.ZodOptional<z.ZodEnum<Record<string, string>>>>,
);
export type Survey = Partial<Record<SurveyKey, string>>;

export function surveyLabel(key: string, value: string | undefined) {
  const q = SURVEY_QUESTIONS.find((x) => x.key === key);
  return q?.options.find((o) => o.value === value)?.label ?? "—";
}
