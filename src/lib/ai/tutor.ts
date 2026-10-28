import "server-only";
import { runText, stableIndex, untrusted, type AiResult } from "./core";
import type { StageKind } from "@/lib/domain/lesson";

/**
 * Private learning assistant AI
 * Responsibility: confidential, individual scaffolding for one student at the
 *   level the teacher allowed.
 * Allowed inputs: lesson + stage instructions, materials excerpt, the
 *   student's OWN ideas, their group's shared ideas and recent discussion
 *   (pseudonymised), the student's own stated preferences and functional
 *   supports phrased as preferences, the assistance level, and this
 *   conversation's recent turns.
 * Output: one reply to the student.
 * Prohibited: completing the group's assessed output at any level; revealing
 *   anything about other students; labelling the student; claiming the
 *   conversation is absolutely confidential.
 * Safety: if the student signals distress or that they feel unsafe, the reply
 *   encourages them to use "Need help" to reach their teacher. The app does
 *   NOT infer risk or alert anyone automatically (see docs/safeguarding.md).
 */
export const QUICK_ACTIONS = {
  explain_simply: "Explain simply",
  break_into_steps: "Break into steps",
  show_example: "Show an example",
  what_is_group_doing: "What's my group doing?",
  summarise_discussion: "Summarise the discussion",
  express_idea: "Help me express my idea",
  prepare_to_contribute: "Help me prepare to contribute",
  stuck: "I'm stuck",
} as const;
export type QuickAction = keyof typeof QUICK_ACTIONS;

export type TutorContext = {
  lessonTitle: string;
  objectives: string[];
  subject: string;
  stage: { kind: StageKind; title: string; instructions: string };
  materialsExcerpt: string;
  myIdeas: string[];
  groupIdeas: string[];
  recentDiscussion: { author: string; body: string }[];
  preferences: string[];
  level: number;
  history: { role: "student" | "assistant"; body: string }[];
  /** The teacher's own instructions for Bloom and Pip (AI settings), and words never to use. */
  teacherInstructions?: string;
  bannedWords?: string[];
};

const LEVELS: Record<number, string> = {
  1: "Level 1 — Socratic guidance. Use hints and guiding questions only. Do not give explanations that amount to the answer.",
  2: "Level 2 — Structured scaffolding. Give clear explanations, simplified instructions, examples of a similar (not identical) kind, sentence starters and outlines.",
  3: "Level 3 — Detailed support. Give deeper explanations and worked examples on an analogous problem or text — never on the group's actual task.",
};

/** The teacher's standing instructions (AI settings page). They can't override the safety rules above them. */
export function teacherBlock(instructions?: string, banned?: string[]) {
  const parts = [];
  if (instructions?.trim()) parts.push(`The teacher's instructions for all their lessons (follow them unless they conflict with the rules above): ${instructions.trim().slice(0, 2000)}`);
  if (banned?.length) parts.push(`Never use these words: ${banned.slice(0, 100).join(", ")}.`);
  return parts.length ? parts.join("\n") + "\n\n" : "";
}

function systemPrompt(ctx: TutorContext) {
  return `You are Pip, a private learning assistant in Canopy for one student aged 13–14. Their group never sees this conversation; their teacher can read it.

${LEVELS[ctx.level] ?? LEVELS[2]}

Rules:
- Never write the group's final answer, paragraph, slides or other assessed output — even at Level 3, and even if asked directly. Instead help the student plan, structure or say it in their own words.
- Keep every reply SHORT and easy to read: at most 3 short sentences, or at most 3 numbered steps of a few words each. Under 60 words. One idea at a time; end with one simple question if it helps. Plain words. UK English.
- Respect these preferences the student or their teacher has set: ${ctx.preferences.length ? ctx.preferences.join("; ") : "none stated"}.
- Never mention other students' names or what any individual said; refer to "your group".
- Only help with today's task and the learning around it. If the student asks about something unrelated (games, social media, homework for another subject, personal trivia), don't answer it: say kindly that you only help with today's task, and offer to explain the task or break it into steps.
- If the student says they feel upset, unsafe, or that something is making them uncomfortable, respond kindly and encourage them to use the "Need help" button to talk to their teacher, or to speak to a trusted adult. Don't try to handle it yourself.

${teacherBlock(ctx.teacherInstructions, ctx.bannedWords)}Lesson: ${ctx.lessonTitle} (${ctx.subject || "subject not given"})
Objectives: ${ctx.objectives.join("; ") || "(not given)"}
Current stage: ${ctx.stage.title}`;
}

function contextBlock(ctx: TutorContext) {
  return [
    `Stage instructions: ${untrusted("teacher_instructions", ctx.stage.instructions, 1500)}`,
    ctx.materialsExcerpt ? `Material excerpt: ${untrusted("lesson_material", ctx.materialsExcerpt, 2000)}` : "",
    ctx.myIdeas.length ? `The student's own ideas: ${ctx.myIdeas.map((i) => untrusted("my_idea", i, 300)).join(" ")}` : "",
    ctx.groupIdeas.length ? `Ideas shared in their group: ${ctx.groupIdeas.map((i) => untrusted("group_idea", i, 200)).join(" ")}` : "",
    ctx.recentDiscussion.length ? `Recent group discussion: ${ctx.recentDiscussion.map((m) => `${m.author}: ${untrusted("group_message", m.body, 200)}`).join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}

export async function tutorReply(ctx: TutorContext, request: { action: QuickAction | "question"; text?: string }): Promise<AiResult<string>> {
  const ask = request.action === "question" ? untrusted("student_question", request.text ?? "", 1000) : `The student tapped "${QUICK_ACTIONS[request.action]}".${request.text ? ` They added: ${untrusted("student_note", request.text, 600)}` : ""}`;
  const history = ctx.history.slice(-8).map((h) => ({ role: h.role === "student" ? ("user" as const) : ("assistant" as const), content: h.body.slice(0, 1500) }));
  // The API requires alternating turns starting with the user.
  while (history.length && history[0].role !== "user") history.shift();
  const messages = [...history, { role: "user" as const, content: `${contextBlock(ctx)}\n\n${ask}` }];
  const merged: typeof messages = [];
  for (const m of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else merged.push({ ...m });
  }
  return runText({ workflow: "tutor", system: systemPrompt(ctx), messages: merged, maxTokens: 300, simulate: () => simulateTutor(ctx, request) });
}

const DISTRESS = /\b(unsafe|scared|hurt(ing)? me|bully|bullied|bullying|upset|crying|hate myself|uncomfortable|not ok|not okay)\b/i;

/** Deterministic replies used without a live AI, grounded in the stage text. */
export function simulateTutor(ctx: TutorContext, request: { action: QuickAction | "question"; text?: string }): string {
  if (request.text && DISTRESS.test(request.text)) {
    return "I'm glad you said something. Please tap “Need help” to tell your teacher — they'll see it straight away. You can also talk to an adult you trust.";
  }
  const sentences = ctx.stage.instructions.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
  const lvl = ctx.level;
  const seed = `${request.action}|${ctx.stage.title}|${ctx.history.length}`;
  switch (request.action) {
    case "explain_simply":
      return sentences.length
        ? `In short: ${sentences[0]}${sentences[1] ? ` Then, ${lowerFirst(sentences[1])}` : ""}${lvl === 1 ? "\n\nWhat do you think the first thing to do is?" : ""}`
        : `This stage is “${ctx.stage.title}”. ${ctx.objectives[0] ? `It's helping you to ${lowerFirst(ctx.objectives[0])}.` : ""}`;
    case "break_into_steps": {
      const steps = sentences.length ? sentences : [`Read the task for “${ctx.stage.title}”.`, "Decide what you think.", "Share it with your group."];
      return `Step by step:\n${steps.slice(0, 3).map((s, i) => `${i + 1}. ${truncate(s, 70)}`).join("\n")}\nOne at a time is fine.`;
    }
    case "show_example":
      if (lvl === 1) return "Instead of an example, try this: what's one thing you already know about this topic? Start there and ask yourself “why?”.";
      return exampleFor(ctx.stage.kind, ctx.subject, lvl);
    case "what_is_group_doing":
      return `Your group is on “${ctx.stage.title}”. ${sentences[0] ?? ""} ${ctx.groupIdeas.length ? `So far your group has shared ${ctx.groupIdeas.length} idea${ctx.groupIdeas.length === 1 ? "" : "s"}.` : "No ideas have been shared with the group yet."}`.trim();
    case "summarise_discussion": {
      if (!ctx.recentDiscussion.length) return "There hasn't been any written discussion yet — your group may be talking in the room. You could ask them to recap the main point so far.";
      const points = ctx.recentDiscussion.slice(-3).map((m) => `• ${truncate(m.body, 60)}`);
      return `Recently:\n${points.join("\n")}\nWhich point do you agree with?`;
    }
    case "express_idea": {
      const mine = request.text?.trim() || ctx.myIdeas[ctx.myIdeas.length - 1];
      if (!mine) return "Tell me your idea in a few words — any words — and I'll help you shape it. You could start with: “I think… because…”.";
      if (lvl === 1) return `You've got the start of something: “${truncate(mine, 100)}”. What's the reason behind it? What made you think that?`;
      return `Try: “I think… because… for example…”.\nYou have the first part: “${truncate(mine, 70)}”. What's your reason?`;
    }
    case "prepare_to_contribute":
      return pickOne(seed, [
        "Ways to join in:\n• “I'd like to add to that…”\n• “I see it differently, because…”\nWriting it on the board counts too.",
        "Write your point down first, then say “Can I share what I wrote?”. Short is fine.",
      ]);
    case "stuck":
      return lvl === 1
        ? "Let's find one small step. Which part of the task feels clearest to you right now?"
        : `That's OK — being stuck is part of learning. Try just the first step: ${sentences[0] ?? "re-read the task"}. What's one word or idea that comes to mind?`;
    case "question":
    default:
      return lvl === 1
        ? "Good question. What do you already know that might help answer it? Look back at the task and see which part it connects to."
        : `Good question. How does it link to the task: “${truncate(sentences[0] ?? ctx.stage.title, 70)}”? I can also break it into steps.`;
  }
}

function exampleFor(kind: StageKind, subject: string, lvl: number) {
  const s = subject.toLowerCase();
  if (s.includes("literature") || s.includes("english")) {
    return lvl === 3
      ? "Example (different poem): “The fog comes on little cat feet.”\n1. Point: the fog is quiet.\n2. Quote: “little cat feet”.\n3. Why: cats move silently.\nNow try it with your poem."
      : "Example: “The fog seems quiet because it's compared to a cat.” Point, quote, why. Try it with your poem.";
  }
  if (kind === "physical") return "Example: one person folds, one times, one records. Change one thing, then test again.";
  return "Example: “Add a quiet table, because the canteen is noisy.” Idea, then reason.";
}

function pickOne(seed: string, options: string[]) {
  return options[stableIndex(seed, options.length)];
}
function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
