import "server-only";
import { z } from "zod";
import { runStructured, untrusted, type AiResult } from "./core";

/**
 * Teacher reporting AI
 * Responsibility: summarise what was recorded in a lesson for the teacher.
 * Allowed inputs: recorded counts and timings per group (pseudonymous group
 *   refs), help-request counts by reason (never content), aggregated
 *   reflection ratings, and anonymised free-text reflection answers.
 * Output: overview, per-group summaries, reflection themes, suggestions.
 * Prohibited: inventing behaviours or events not in the data; diagnosing;
 *   inferring disability or severity; scoring social ability; ranking students;
 *   naming individuals.
 * Verification: group refs must match the input.
 */
export type ReportFacts = {
  lessonTitle: string;
  durationMinutes: number;
  attendance: number;
  enrolled: number;
  groups: { ref: string; stagesCompleted: number; totalStages: number; extensionsSeconds: number; helpRequests: Record<string, number>; submitted: boolean; ideasShared: number; messages: number }[];
  reflection: { responses: number; averages: Record<string, number | null>; freeText: string[] };
};

export const reportSchema = z.object({
  overview: z.string(),
  groupSummaries: z.array(z.object({ groupRef: z.string(), summary: z.string() })),
  reflectionThemes: z.array(z.object({ theme: z.string(), mentions: z.number() })),
  suggestions: z.array(z.string()),
});
export type ReportSummary = z.infer<typeof reportSchema>;

const SYSTEM = `You write a short, factual post-lesson summary for a teacher. Use ONLY the recorded facts given. If something isn't in the data, don't mention it.
- Never diagnose, label or rank students, infer support needs or disability, or score social ability. Talk about groups and the lesson process, not individuals.
- Clearly separate what was recorded from suggestions. Suggestions are optional ideas about the activity design (timings, structure, prompts).
- Reflection themes come only from the students' own words; count how many answers mention each theme.
- British English, concise, neutral.`;

export async function summariseLesson(facts: ReportFacts): Promise<AiResult<ReportSummary>> {
  const refs = new Set(facts.groups.map((g) => g.ref));
  const prompt = [
    `Lesson: ${facts.lessonTitle}. Duration: ${facts.durationMinutes} minutes. Attendance: ${facts.attendance} of ${facts.enrolled}.`,
    "Recorded group data (JSON):",
    JSON.stringify(facts.groups),
    `Reflection: ${facts.reflection.responses} responses. Average ratings (1–5): ${JSON.stringify(facts.reflection.averages)}`,
    facts.reflection.freeText.length ? `Anonymised free-text answers:\n${facts.reflection.freeText.slice(0, 60).map((t) => untrusted("student_reflection", t, 300)).join("\n")}` : "No free-text answers.",
  ].join("\n");
  return runStructured({
    workflow: "report",
    system: SYSTEM,
    prompt,
    schema: reportSchema,
    maxTokens: 1800,
    simulate: () => simulateReport(facts),
    verify: (r) => r.groupSummaries.every((g) => refs.has(g.groupRef)),
  });
}

const THEMES: { theme: string; words: RegExp }[] = [
  { theme: "Thinking time before discussing", words: /\b(time to think|thinking time|on my own first|write.*first|quiet)\b/i },
  { theme: "Clear roles", words: /\b(role|roles|job|jobs)\b/i },
  { theme: "Being listened to", words: /\b(listen|listened|heard|included)\b/i },
  { theme: "AI help / hints", words: /\b(ai|sprout|hint|assistant|helper)\b/i },
  { theme: "Group disagreement", words: /\b(argue|argued|disagree|disagreed|argument)\b/i },
  { theme: "Time pressure", words: /\b(rushed|more time|not enough time|timer|too quick)\b/i },
  { theme: "Noise or distraction", words: /\b(noise|noisy|loud|distract)\b/i },
  { theme: "Unclear instructions", words: /\b(confus|unclear|didn'?t understand|instructions)\b/i },
];

export function reflectionThemes(freeText: string[]) {
  return THEMES.map((t) => ({ theme: t.theme, mentions: freeText.filter((x) => t.words.test(x)).length })).filter((t) => t.mentions > 0).sort((a, b) => b.mentions - a.mentions);
}

export function simulateReport(f: ReportFacts): ReportSummary {
  const completed = f.groups.filter((g) => g.stagesCompleted >= g.totalStages).length;
  const submitted = f.groups.filter((g) => g.submitted).length;
  const totalHelp = f.groups.reduce((a, g) => a + Object.values(g.helpRequests).reduce((x, y) => x + y, 0), 0);
  const avg = f.reflection.averages;
  const low = Object.entries(avg).filter(([, v]) => v !== null && v < 3).map(([k]) => k);
  const suggestions: string[] = [];
  if (f.groups.some((g) => g.extensionsSeconds > 0)) suggestions.push("Some groups needed extra time — consider lengthening the stages where extensions were given.");
  if (low.includes("clarity")) suggestions.push("Students rated instruction clarity below 3 on average — a short worked example at the start could help.");
  if (low.includes("opportunity")) suggestions.push("Perceived opportunity to participate was lower — try a turn-taking structure or a longer individual thinking stage.");
  if (!suggestions.length) suggestions.push("No specific adjustments are indicated by the recorded data.");
  return {
    overview: `${f.attendance} of ${f.enrolled} students took part in “${f.lessonTitle}” over about ${f.durationMinutes} minutes. ${completed} of ${f.groups.length} groups completed every stage and ${submitted} submitted work. ${totalHelp} help request${totalHelp === 1 ? " was" : "s were"} sent to you during the lesson.`,
    groupSummaries: f.groups.map((g) => ({
      groupRef: g.ref,
      summary: `Completed ${g.stagesCompleted} of ${g.totalStages} stages${g.extensionsSeconds ? `, with ${Math.round(g.extensionsSeconds / 60)} min of extra time` : ""}. ${g.ideasShared} idea${g.ideasShared === 1 ? "" : "s"} shared and ${g.messages} written message${g.messages === 1 ? "" : "s"} (discussion in the room isn't recorded). ${g.submitted ? "Work submitted." : "No submission recorded."}`,
    })),
    reflectionThemes: reflectionThemes(f.reflection.freeText),
    suggestions,
  };
}
