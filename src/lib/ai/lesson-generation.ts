import "server-only";
import { z } from "zod";
import { runStructured, untrusted, type AiResult } from "./core";
import {
  DEFAULT_ROLES, GAMIFICATION_THEMES, STAGE_KINDS, defaultConfig, makeStage, type LessonDraft, type StageKind,
} from "@/lib/domain/lesson";

/**
 * Lesson generation AI
 * Responsibility: turn a teacher's natural-language description into an
 *   editable, structured lesson draft.
 * Allowed inputs: the teacher's description, optional subject/year/duration.
 *   No student data of any kind.
 * Output: the schema below, then normalised into a LessonDraft.
 * Prohibited: inventing facts about specific students; producing assessed
 *   answers; skipping teacher approval (drafts are saved unapproved and must be
 *   explicitly approved in the builder before launch).
 */
export const generatedLessonSchema = z.object({
  title: z.string(),
  description: z.string(),
  objectives: z.array(z.string()),
  stages: z.array(
    z.object({
      kind: z.enum(STAGE_KINDS),
      title: z.string(),
      instructions: z.string(),
      minutes: z.number(),
      artifacts: z.array(z.enum(["document", "whiteboard", "slides"])),
    }),
  ),
  outputType: z.enum(["document", "whiteboard", "slides", "photo", "mixed"]),
  roleKeys: z.array(z.string()),
  gamificationTheme: z.enum(GAMIFICATION_THEMES),
  rationale: z.string(),
});
type Generated = z.infer<typeof generatedLessonSchema>;

const SYSTEM = `You are Canopy's lesson design assistant for UK secondary teachers. You turn a teacher's description into a structured, cooperative group activity for students aged 13–14, designed so that students with different communication styles and support needs can all participate.

Design principles:
- Always give students individual thinking time before group discussion when ideas are involved.
- Prefer clear, short, numbered instructions written directly to students.
- Use only these stage kinds: ${STAGE_KINDS.join(", ")}.
- Use "synthesis" only after a "brainstorm" stage. Use "voting" only when a decision is needed. Use "physical" for hands-on making in the room (the AI never listens to the room). Use "talk" for a short screens-down, face-to-face conversation (usually after ideas have been shared).
- "creation" stages must list at least one artifact (document, whiteboard or slides).
- Make the stage minutes add up to the requested duration when one is given.
- Role keys must come from: ${DEFAULT_ROLES.map((r) => r.key).join(", ")}.
- "rationale" is one or two sentences addressed to the teacher explaining the structure.
You are drafting: the teacher reviews and edits everything before use.`;

export async function generateLessonDraft(input: { description: string; subject?: string; yearLevel?: string; minutes?: number }): Promise<AiResult<{ draft: LessonDraft; rationale: string }>> {
  const prompt = [
    input.subject ? `Subject: ${input.subject}` : "",
    input.yearLevel ? `Year level: ${input.yearLevel}` : "",
    input.minutes ? `Total duration: ${input.minutes} minutes` : "",
    "Teacher's description:",
    untrusted("teacher_description", input.description, 2000),
  ].filter(Boolean).join("\n");

  const result = await runStructured({
    workflow: "lesson",
    system: SYSTEM,
    prompt,
    schema: generatedLessonSchema,
    maxTokens: 2500,
    simulate: () => simulateLesson(input),
    verify: (g) => g.stages.length > 0 && g.stages.length <= 12,
  });
  return { origin: result.origin, data: { draft: normalise(result.data, input), rationale: result.data.rationale } };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));
}

/** Convert loosely-typed model output into a valid, safe LessonDraft. */
export function normalise(g: Generated, input: { subject?: string; yearLevel?: string }): LessonDraft {
  const roles = DEFAULT_ROLES.filter((r) => g.roleKeys.includes(r.key));
  return {
    title: g.title.slice(0, 160) || "Untitled lesson",
    description: g.description.slice(0, 2000),
    subject: input.subject ?? "",
    yearLevel: input.yearLevel ?? "",
    objectives: g.objectives.map((o) => o.slice(0, 240)).filter(Boolean).slice(0, 8),
    config: defaultConfig({
      outputType: g.outputType,
      gamificationTheme: g.gamificationTheme,
      roles: roles.length ? roles : DEFAULT_ROLES.slice(0, 4),
      modality: g.stages.some((s) => s.kind === "physical") ? "mostly_in_person" : "mixed",
      presentationRequired: g.stages.some((s) => s.kind === "presentation"),
    }),
    stages: g.stages.slice(0, 12).map((s) =>
      makeStage(s.kind, {
        title: s.title.slice(0, 120) || undefined,
        instructions: s.instructions.slice(0, 4000),
        durationSeconds: clamp(s.minutes, 1, 60) * 60,
        config: s.kind === "creation" ? { artifacts: s.artifacts.length ? s.artifacts : ["document"] } : undefined,
      }),
    ),
  };
}

/** Deterministic keyword-driven draft used without an API key. */
export function simulateLesson(input: { description: string; minutes?: number }): Generated {
  const text = input.description.toLowerCase();
  const total = input.minutes ?? Number(text.match(/(\d{1,3})\s*-?\s*min/)?.[1] ?? 30);
  const has = (...words: string[]) => words.some((w) => text.includes(w));
  const kinds: { kind: StageKind; title: string; instructions: string; weight: number; artifacts?: ("document" | "whiteboard" | "slides")[] }[] = [];

  const physical = has("build", "make", "construct", "paper aeroplane", "hands-on", "experiment", "model");
  kinds.push({ kind: "orientation", title: "Get started", instructions: "Read the task together. Check everyone knows what the group needs to produce by the end.", weight: 1 });
  if (has("role")) kinds.push({ kind: "role_selection", title: "Choose roles", instructions: "Pick roles so everyone has a clear way to contribute. You can hold more than one.", weight: 1 });
  if (!physical || has("brainstorm", "idea")) {
    kinds.push({ kind: "brainstorm", title: "Think on your own", instructions: "Write down your own ideas first. One clear idea you can explain is better than lots of quick ones.", weight: 2 });
    kinds.push({ kind: "synthesis", title: "See the group's ideas", instructions: "Look at how the ideas have been grouped. Rename or move anything that doesn't fit.", weight: 1.5 });
  }
  kinds.push({ kind: "discussion", title: has("evidence", "poem", "text", "analyse", "analyze") ? "Discuss the evidence" : "Discuss", instructions: has("evidence", "poem", "analyse") ? "Take turns choosing an idea that isn't yours. Which words or lines support it?" : "Take turns sharing. Build on at least one idea that isn't yours.", weight: 3 });
  if (has("vote", "decide", "choose", "prioritise", "prioritize")) kinds.push({ kind: "voting", title: "Decide together", instructions: "Each person places their votes. Talk about the result before moving on.", weight: 1 });
  if (physical) kinds.push({ kind: "physical", title: "Build and test", instructions: "Work in the room. Tick off each check-in as you reach it, and take a photo of your work.", weight: 4 });
  const slides = has("slide", "present", "pitch");
  const board = has("whiteboard", "diagram", "map", "plan");
  if (!physical || has("write", "report", "response")) {
    kinds.push({
      kind: "creation",
      title: has("write", "response", "paragraph", "essay") ? "Write together" : "Create together",
      instructions: has("write", "response") ? "Write your group's response together. Include more than one person's idea and at least one piece of evidence." : "Build your group's shared output together.",
      weight: 4,
      artifacts: slides ? ["slides"] : board ? ["whiteboard"] : ["document"],
    });
  }
  kinds.push({ kind: "submission", title: physical ? "Capture your evidence" : "Submit", instructions: "Check your work together, then one person submits it for the group.", weight: 1 });
  if (has("present", "share with the class")) kinds.push({ kind: "presentation", title: "Present", instructions: "Share your work with the class.", weight: 2 });
  if (has("reflect")) kinds.push({ kind: "reflection", title: "Reflect", instructions: "How did your group work together today?", weight: 1 });

  const weightSum = kinds.reduce((a, k) => a + k.weight, 0);
  const topic = input.description.replace(/\s+/g, " ").trim().slice(0, 70);
  return {
    title: topic.length > 6 ? topic.charAt(0).toUpperCase() + topic.slice(1) : "New group activity",
    description: input.description.slice(0, 500),
    objectives: [
      "Develop and explain an individual idea",
      "Build on other people's ideas respectfully",
      physical ? "Plan, test and record results as a team" : "Produce a shared response that includes several perspectives",
    ],
    stages: kinds.map((k) => ({ kind: k.kind, title: k.title, instructions: k.instructions, minutes: Math.max(1, Math.round((k.weight / weightSum) * total)), artifacts: k.artifacts ?? [] })),
    outputType: physical ? "photo" : slides ? "slides" : board ? "whiteboard" : "document",
    roleKeys: physical ? ["facilitator", "timekeeper", "materials", "presenter"] : ["facilitator", "note_taker", "questioner", "presenter"],
    gamificationTheme: physical ? "journey" : "garden",
    rationale: "Simulated draft built from keywords in your description: individual thinking comes before discussion, and the timings are spread across the stages in proportion to their weight. Please review every stage.",
  };
}
