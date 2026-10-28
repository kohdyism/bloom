import "server-only";
import { z } from "zod";
import { runStructured, untrusted } from "./core";
import { CHAT_NOTES, ruleCheck, type FlagCategory } from "@/lib/domain/moderation";

/**
 * Supervised group chat: Bloom reads a student's message before the group
 * sees it. On-task messages (including small talk that keeps the group
 * working: "ok", "agree", "nice idea") go straight through. Off-task or
 * unkind messages are held back, and only the writer is told why, kindly.
 */
export type ChatVerdict = { verdict: "ok" | FlagCategory; note: string };

const schema = z.object({
  verdict: z.enum(["ok", "off_task", "unkind", "inappropriate"]),
  note: z.string().describe("One short, kind sentence to the student explaining why it was held back (empty if ok)."),
});

const SYSTEM = `You supervise a school group chat for students aged about 11-16 during a classroom task.
Decide whether the NEW message should be shared with the group.
- "ok": anything connected to the task or to working together (ideas, questions, quotes, agreeing, planning, roles, "ok", "yes", "good idea", asking for help, short friendly encouragement). When unsure, choose "ok". Spelling mistakes and casual tone are fine.
- "off_task": clearly unrelated to the lesson or group work (games, social plans, memes, random spam, keyboard mashing).
- "unkind": insults, teasing, put-downs, swearing at someone, or exclusion.
- "inappropriate": sexual content, drugs, threats of violence, or anything not OK to share in a classroom.
For off_task or unkind, write one short, warm sentence to the student (max 20 words) that says why and nudges them back to the task. Never repeat the message.`;

/** Quick rules used first, and when AI is off, unavailable or simulated. */
export function quickCheck(text: string): ChatVerdict {
  const v = ruleCheck(text);
  return v ? { verdict: v, note: CHAT_NOTES[v] } : { verdict: "ok", note: "" };
}

export async function reviewChatMessage(input: { lesson: string; stage: string; instructions: string; recent: string[]; text: string }): Promise<ChatVerdict> {
  const quick = quickCheck(input.text);
  // Clear-cut cases don't need the AI.
  if (quick.verdict !== "ok") return quick;
  if (input.text.trim().length <= 3) return quick;
  const res = await runStructured({
    workflow: "facilitator",
    system: SYSTEM,
    prompt: [
      `Lesson: ${input.lesson}`,
      `Current stage: ${input.stage}`,
      untrusted("task instructions", input.instructions, 800),
      untrusted("recent group messages (oldest first)", input.recent.slice(-6).join("\n"), 1500),
      untrusted("new message", input.text, 600),
    ].join("\n\n"),
    schema,
    maxTokens: 200,
    timeoutMs: 6000,
    simulate: () => ({ verdict: "ok" as const, note: "" }),
  });
  // If the AI couldn't answer, fall back to the quick rules rather than blocking the chat.
  if (res.origin === "offline_helper") return quick;
  const v = res.data;
  return { verdict: v.verdict, note: v.verdict === "ok" ? "" : (v.note || CHAT_NOTES[v.verdict]).slice(0, 200) };
}
