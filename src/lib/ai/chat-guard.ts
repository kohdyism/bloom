import "server-only";
import { z } from "zod";
import { runStructured, untrusted } from "./core";

/**
 * Supervised group chat: Bloom reads a student's message before the group
 * sees it. On-task messages (including small talk that keeps the group
 * working: "ok", "agree", "nice idea") go straight through. Off-task or
 * unkind messages are held back, and only the writer is told why, kindly.
 */
export type ChatVerdict = { verdict: "ok" | "off_task" | "unkind"; note: string };

const schema = z.object({
  verdict: z.enum(["ok", "off_task", "unkind"]),
  note: z.string().describe("One short, kind sentence to the student explaining why it was held back (empty if ok)."),
});

const SYSTEM = `You supervise a school group chat for students aged about 11-16 during a classroom task.
Decide whether the NEW message should be shared with the group.
- "ok": anything connected to the task or to working together (ideas, questions, quotes, agreeing, planning, roles, "ok", "yes", "good idea", asking for help, short friendly encouragement). When unsure, choose "ok". Spelling mistakes and casual tone are fine.
- "off_task": clearly unrelated to the lesson or group work (games, social plans, memes, random spam, keyboard mashing).
- "unkind": insults, teasing, put-downs, swearing at someone, exclusion, or anything unsafe.
For off_task or unkind, write one short, warm sentence to the student (max 20 words) that says why and nudges them back to the task. Never repeat the message.`;

const UNKIND = /\b(stupid|idiot|dumb|shut up|loser|ugly|hate you|freak|moron|retard|stfu|kys)\b/i;
const OFF_TASK = /\b(fortnite|roblox|minecraft|tiktok|youtube|instagram|snap(chat)?|lunch break plans|who wants to play)\b/i;
const MASH = /^(.)\1{5,}$|^([a-z]{1,3})\2{3,}$/i;

/** Quick rules used when AI is off, unavailable or simulated. */
export function quickCheck(text: string): ChatVerdict {
  const t = text.trim();
  if (UNKIND.test(t)) return { verdict: "unkind", note: "That could hurt someone — try saying it in a kinder way." };
  if (MASH.test(t.replace(/\s/g, "")) || OFF_TASK.test(t)) return { verdict: "off_task", note: "That doesn't look like it's about the task — keep the chat for your group's work." };
  return { verdict: "ok", note: "" };
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
    simulate: () => quick,
  });
  // If the AI couldn't answer, fall back to the quick rules rather than blocking the chat.
  if (res.origin === "offline_helper") return quick;
  const v = res.data;
  return { verdict: v.verdict, note: v.verdict === "ok" ? "" : (v.note || quick.note || "That doesn't seem to be about the task.").slice(0, 200) };
}
