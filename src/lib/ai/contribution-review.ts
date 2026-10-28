import "server-only";
import { z } from "zod";
import { runStructured, untrusted, type AiResult } from "./core";

/**
 * Suggests a quality rating for one student's WRITTEN contributions in one
 * lesson, for the teacher to check. It never sees support needs, never judges
 * spelling, grammar or length, and says so when there isn't enough written
 * evidence (many students contribute out loud).
 */
export const LEVELS = ["Emerging", "Developing", "Secure", "Strong"] as const;
export const CRITERIA = [
  { key: "ideas", label: "Ideas", what: "How relevant and thoughtful the student's ideas are for the task" },
  { key: "reasoning", label: "Reasoning", what: "Whether they explain why, use evidence or examples" },
  { key: "building", label: "Building on others", what: "Whether they respond to and develop other people's ideas" },
] as const;
export type CriterionKey = (typeof CRITERIA)[number]["key"];

const criterion = z.object({
  level: z.number().int().min(1).max(4).nullable().describe("1 Emerging, 2 Developing, 3 Secure, 4 Strong; null if there is not enough written evidence"),
  reason: z.string().describe("One short sentence (max 25 words) explaining the level, referring to what the student wrote"),
});
const schema = z.object({
  ideas: criterion,
  reasoning: criterion,
  building: criterion,
  summary: z.string().describe("Two short sentences for the teacher: a strength and one next step (max 45 words). Kind, specific, no labels."),
  evidence: z.array(z.string()).max(3).describe("Up to 3 short exact quotes (max 20 words each) from the student's own writing that support the levels"),
});
export type ReviewResult = z.infer<typeof schema>;

export type ReviewInput = {
  lessonTitle: string;
  objectives: string[];
  tasks: string[];
  ideas: { text: string; buildsOnOthers: boolean }[];
  messages: string[];
  reflection: string[];
  groupWorkExcerpt: string;
  edits: number;
};

const SYSTEM = `You help a teacher review one student's written contributions in one group lesson (students aged 11-16, many with special educational needs).
Rate each criterion 1-4 (1 Emerging, 2 Developing, 3 Secure, 4 Strong) using ONLY the student's own writing provided.
Rules:
- Judge the thinking, not the writing: never mark down spelling, grammar, handwriting-like errors, length or style.
- If there is too little written evidence for a criterion, use null and say so. Students may have contributed out loud, which you cannot see — never treat silence as low quality.
- The group's shared work is context only; you cannot tell who wrote which part, so don't credit or blame the student for it.
- Never guess at needs, diagnoses, effort, attitude or personality. No labels. Be kind, specific and brief.
- Quotes in "evidence" must be copied exactly from the student's own ideas or messages.`;

/** Simple, explainable fallback when AI isn't live. */
function simulate(i: ReviewInput): ReviewResult {
  const texts = [...i.ideas.map((x) => x.text), ...i.messages];
  const words = texts.join(" ").split(/\s+/).filter(Boolean).length;
  const because = texts.filter((t) => /\b(because|so that|since|for example|this means|which shows|evidence)\b/i.test(t)).length;
  const builds = i.ideas.filter((x) => x.buildsOnOthers).length + i.messages.filter((m) => /\b(agree|build|add to|also|yes,? and|what if)\b/i.test(m)).length;
  const lvl = (n: number, steps: number[]) => (n >= steps[2] ? 4 : n >= steps[1] ? 3 : n >= steps[0] ? 2 : 1);
  const ideasLevel = i.ideas.length ? lvl(i.ideas.length + Math.floor(words / 25), [2, 3, 5]) : null;
  return {
    ideas: { level: ideasLevel, reason: ideasLevel ? `Shared ${i.ideas.length} idea${i.ideas.length === 1 ? "" : "s"} linked to the task.` : "No written ideas to go on — they may have shared ideas out loud." },
    reasoning: { level: texts.length ? lvl(because, [1, 2, 3]) : null, reason: texts.length ? (because ? "Gives reasons in some of their writing." : "Ideas are stated without reasons yet.") : "Not enough written evidence." },
    building: { level: texts.length ? lvl(builds, [1, 2, 3]) : null, reason: texts.length ? (builds ? "Responds to and adds to others' ideas." : "Hasn't yet built on others' ideas in writing.") : "Not enough written evidence." },
    summary: texts.length ? "Shared written ideas with the group. Next step: add “because…” to explain each idea." : "Little written work in this lesson; check how they took part in the room.",
    evidence: texts.filter((t) => t.split(/\s+/).length <= 20).slice(0, 2),
  };
}

export async function reviewContribution(input: ReviewInput): Promise<AiResult<ReviewResult>> {
  const prompt = [
    `Lesson: ${input.lessonTitle}`,
    `Objectives: ${input.objectives.join("; ") || "(not given)"}`,
    untrusted("tasks", input.tasks.join("\n"), 1500),
    untrusted("student ideas", input.ideas.map((x) => `${x.buildsOnOthers ? "[builds on a groupmate's idea] " : ""}${x.text}`).join("\n") || "(none)", 3000),
    untrusted("student chat messages", input.messages.join("\n") || "(none)", 2500),
    untrusted("student reflection answers", input.reflection.join("\n") || "(none)", 1000),
    untrusted("group shared work (context only)", input.groupWorkExcerpt || "(none)", 1500),
    `Edits the student made to the shared work: ${input.edits}`,
  ].join("\n\n");
  const res = await runStructured({ workflow: "report", system: SYSTEM, prompt, schema, maxTokens: 900, simulate: () => simulate(input) });
  // Quotes must really be the student's own words.
  const own = [...input.ideas.map((x) => x.text), ...input.messages].join("\n").toLowerCase();
  res.data.evidence = res.data.evidence.filter((q) => q.trim() && own.includes(q.trim().toLowerCase().replace(/^["“]|["”]$/g, "")));
  if (res.origin === "offline_helper") return { data: simulate(input), origin: "offline_helper" };
  return res;
}
