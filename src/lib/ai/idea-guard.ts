import "server-only";
import { z } from "zod";
import { runStructured, untrusted } from "./core";
import { IDEA_NOTES, looksLikeNonsense, ruleCheck } from "@/lib/domain/moderation";

/**
 * Ideas are checked before the group sees them: nonsense ("asdfgh"), ideas
 * that have nothing to do with the task, and unkind or inappropriate ones are
 * held back with a kind note. When unsure, the idea goes through: a short or
 * unusual idea is still an idea.
 */
export type IdeaVerdict = { verdict: "ok" | "nonsense" | "off_task" | "unkind" | "inappropriate" | "safeguarding"; note: string };

const schema = z.object({
  verdict: z.enum(["ok", "nonsense", "off_task", "unkind", "inappropriate"]),
});

const SYSTEM = `You check one idea a school student (aged 11-16) is about to share with their group during a classroom task.
- "ok": any genuine attempt at the task, however short, simple, misspelled, unusual or partly wrong. Questions about the task and half-formed ideas are ok. When unsure, choose "ok".
- "nonsense": not an attempt at all (random letters, a single filler word, copy-pasted junk).
- "off_task": clearly about something unrelated to the task (games, social plans, jokes with no link to the topic).
- "unkind": insults or put-downs of a person or group.
- "inappropriate": sexual content, drugs, violence threats, or anything not OK in a classroom.
Students may have additional needs: never judge spelling, grammar, length or quality — only whether it is a real, on-topic, kind attempt.`;

export function quickIdeaCheck(text: string): IdeaVerdict {
  const v = ruleCheck(text);
  if (v) return { verdict: v, note: IDEA_NOTES[v] };
  if (looksLikeNonsense(text)) return { verdict: "nonsense", note: IDEA_NOTES.nonsense };
  return { verdict: "ok", note: "" };
}

export async function reviewIdea(input: { lesson: string; stage: string; instructions: string; teacherInstructions: string; text: string; useAi: boolean }): Promise<IdeaVerdict> {
  const quick = quickIdeaCheck(input.text);
  if (quick.verdict !== "ok" || !input.useAi) return quick;
  const res = await runStructured({
    workflow: "facilitator",
    system: SYSTEM + (input.teacherInstructions ? `\nThe teacher's own guidance (follow it unless it conflicts with the rules above): ${input.teacherInstructions.slice(0, 1000)}` : ""),
    prompt: [`Lesson: ${input.lesson}`, `Current stage: ${input.stage}`, untrusted("task instructions", input.instructions, 800), untrusted("idea", input.text, 1000)].join("\n\n"),
    schema,
    maxTokens: 60,
    timeoutMs: 6000,
    simulate: () => ({ verdict: "ok" as const }),
  });
  // If the AI can't answer, never block the student.
  if (res.origin === "offline_helper" || res.data.verdict === "ok") return { verdict: "ok", note: "" };
  return { verdict: res.data.verdict, note: IDEA_NOTES[res.data.verdict] };
}
