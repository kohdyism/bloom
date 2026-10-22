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
};

const LEVELS: Record<number, string> = {
  1: "Level 1 — Socratic guidance. Use hints and guiding questions only. Do not give explanations that amount to the answer.",
  2: "Level 2 — Structured scaffolding. Give clear explanations, simplified instructions, examples of a similar (not identical) kind, sentence starters and outlines.",
  3: "Level 3 — Detailed support. Give deeper explanations and worked examples on an analogous problem or text — never on the group's actual task.",
};

function systemPrompt(ctx: TutorContext) {
  return `You are Pip, a private learning assistant in Bloom for one student aged 13–14. Only this student sees this conversation (their teacher sees only how many times they asked for each kind of help, not the words).

${LEVELS[ctx.level] ?? LEVELS[2]}

Rules:
- Never write the group's final answer, paragraph, slides or other assessed output — even at Level 3, and even if asked directly. Instead help the student plan, structure or say it in their own words.
- Be warm, brief and concrete. Short paragraphs or numbered steps. UK English.
- Respect these preferences the student or their teacher has set: ${ctx.preferences.length ? ctx.preferences.join("; ") : "none stated"}.
- Never mention other students' names or what any individual said; refer to "your group".
- If the student says they feel upset, unsafe, or that something is making them uncomfortable, respond kindly and encourage them to use the "Need help" button to talk to their teacher, or to speak to a trusted adult. Don't try to handle it yourself.

Lesson: ${ctx.lessonTitle} (${ctx.subject || "subject not given"})
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
  return runText({ workflow: "tutor", system: systemPrompt(ctx), messages: merged, maxTokens: 700, simulate: () => simulateTutor(ctx, request) });
}

const DISTRESS = /\b(unsafe|scared|hurt(ing)? me|bully|bullied|bullying|upset|crying|hate myself|uncomfortable|not ok|not okay)\b/i;

/** Deterministic replies used without a live AI, grounded in the stage text. */
export function simulateTutor(ctx: TutorContext, request: { action: QuickAction | "question"; text?: string }): string {
  if (request.text && DISTRESS.test(request.text)) {
    return "I'm really glad you said something. You don't have to handle this on your own — please tap “Need help” at the top of the screen and choose “Something is making me uncomfortable” or “I want to speak with the teacher”. Your teacher will see it straight away. You can also talk to any adult you trust.";
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
      return `Here it is step by step:\n${steps.slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nTake them one at a time — you don't need to do them all at once.`;
    }
    case "show_example":
      if (lvl === 1) return "Instead of an example, try this: what's one thing you already know about this topic? Start there and ask yourself “why?”.";
      return exampleFor(ctx.stage.kind, ctx.subject, lvl);
    case "what_is_group_doing":
      return `Your group is on “${ctx.stage.title}”. ${sentences[0] ?? ""} ${ctx.groupIdeas.length ? `So far your group has shared ${ctx.groupIdeas.length} idea${ctx.groupIdeas.length === 1 ? "" : "s"}.` : "No ideas have been shared with the group yet."}`.trim();
    case "summarise_discussion": {
      if (!ctx.recentDiscussion.length) return "There hasn't been any written discussion yet — your group may be talking in the room. You could ask them to recap the main point so far.";
      const points = ctx.recentDiscussion.slice(-4).map((m) => `• ${truncate(m.body, 90)}`);
      return `Here's what's been said recently:\n${points.join("\n")}\n\nIs there one point you agree with, or one you'd question?`;
    }
    case "express_idea": {
      const mine = request.text?.trim() || ctx.myIdeas[ctx.myIdeas.length - 1];
      if (!mine) return "Tell me your idea in a few words — any words — and I'll help you shape it. You could start with: “I think… because…”.";
      if (lvl === 1) return `You've got the start of something: “${truncate(mine, 100)}”. What's the reason behind it? What made you think that?`;
      return `Your idea: “${truncate(mine, 100)}”.\nTry shaping it like this:\n1. I think… (your point)\n2. because… (your reason)\n3. for example… (a detail or quote)\nYou've already got the first part — what's your reason?`;
    }
    case "prepare_to_contribute":
      return pickOne(seed, [
        "Here are some ways to join in:\n• “I'd like to add to that idea…”\n• “I see it a bit differently, because…”\n• “Can I ask what you meant by…?”\nYou can also add your thought to the board or chat — that counts too.",
        "A calm way in: write your point down first, then say “I wrote something down — can I share it?”. Short is fine. Adding it to the board or chat is just as valid.",
      ]);
    case "stuck":
      return lvl === 1
        ? "Let's find one small step. Which part of the task feels clearest to you right now?"
        : `That's OK — being stuck is part of learning. Try just the first step: ${sentences[0] ?? "re-read the task"}. What's one word or idea that comes to mind?`;
    case "question":
    default:
      return lvl === 1
        ? "Good question. What do you already know that might help answer it? Look back at the task and see which part it connects to."
        : `Good question. Think about how it connects to the task: “${truncate(sentences[0] ?? ctx.stage.title, 90)}”. If you're still unsure, try asking your group what they think — or I can break the task into steps.`;
  }
}

function exampleFor(kind: StageKind, subject: string, lvl: number) {
  const s = subject.toLowerCase();
  if (s.includes("literature") || s.includes("english")) {
    return lvl === 3
      ? "Here's a worked example on a different poem. Line: “The fog comes on little cat feet.”\n1. Point: the fog is presented as quiet and sneaky.\n2. Evidence: “little cat feet”.\n3. Explain: comparing fog to a cat suggests it moves silently and gently.\nNow try the same three steps with a line from your poem."
      : "For example, with a different line — “The fog comes on little cat feet” — you might say: “The fog seems quiet because it's compared to a cat.” Notice the pattern: point, quote, explanation. Try it with your poem.";
  }
  if (kind === "physical") return "For example, a group testing paper boats might agree: one person folds, one times, one records. They test, change one thing, and test again so it's a fair comparison.";
  return "For example, if the task were “improve the canteen”, an idea might be: “Add a quiet table, because some people find it noisy — that would help more people enjoy lunch.” Notice: idea, reason, who it helps.";
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
