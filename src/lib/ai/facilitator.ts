import "server-only";
import { runText, stableIndex, untrusted, type AiResult } from "./core";
import type { StageKind } from "@/lib/domain/lesson";

/**
 * Group facilitator AI
 * Responsibility: support the group through the current stage — introduce it,
 *   scaffold thinking, invite broad participation, help with disagreement,
 *   reconnect to the goal, and invite readiness confirmation.
 * Allowed inputs: stage + lesson objective, materials excerpt, shared ideas and
 *   recent group messages with members pseudonymised ("Member A"), role names,
 *   teacher-configured intensity and assistance level.
 * Never receives: real names, support needs/accommodations, private assistant
 *   conversations, help requests, teacher notes.
 * Output: one short group-visible message (plain text).
 * Prohibited: naming or singling out individuals, judging participation,
 *   writing the group's assessed output, pressuring anyone to speak.
 * Loop safety: callers only invoke this from deduplicated triggers; AI and
 *   system messages never trigger further AI messages.
 */
export type FacilitatorTrigger =
  | { kind: "stage_intro" }
  | { kind: "no_ideas_yet" }
  | { kind: "ready_check" }
  | { kind: "broaden_participation" }
  | { kind: "refocus" }
  | { kind: "time_warning"; minutes: number }
  | { kind: "ask"; quick: "explain_task" | "discussion_question" | "we_disagree" | "we_are_stuck" | "question"; question?: string };

export type FacilitatorContext = {
  lessonTitle: string;
  objectives: string[];
  stage: { kind: StageKind; title: string; instructions: string };
  nextStageTitle?: string;
  materialsExcerpt: string;
  sharedIdeas: string[];
  recentMessages: { author: string; body: string }[];
  roles: { member: string; role: string }[];
  intensity: "low" | "moderate" | "high";
  assistanceLevel: number;
  outputType: string;
};

function systemPrompt(ctx: FacilitatorContext) {
  return `You are Bloom, the group facilitator in Canopy, a classroom collaboration tool for students aged 13–14. Your job is to help the group think and work together — you are not a group member and you don't do their thinking for them.

How you speak:
- 1–3 short sentences, or a very short list. Warm, calm, encouraging, never childish.
- Address the whole group ("you all", "your group"). Never name, single out, praise or criticise one person. Never mention who has or hasn't contributed.
- Remember students may be contributing out loud in the room, on the board, or in writing — silence in the chat is not disengagement. Invite, never pressure.
- Ask questions that make students explain their reasoning and use evidence. Encourage building on each other's ideas and respectful disagreement.
- Academic support level ${ctx.assistanceLevel} of 3 (1 = only guiding questions, 2 = clear explanations and scaffolds, 3 = deeper explanation with an analogous example). At every level, never write the group's answer, paragraph, slides or final output.

Lesson: ${ctx.lessonTitle}
Objectives: ${ctx.objectives.join("; ") || "(not given)"}
Current stage: ${ctx.stage.title} (${ctx.stage.kind})
Final output: ${ctx.outputType}`;
}

function userPrompt(trigger: FacilitatorTrigger, ctx: FacilitatorContext) {
  const parts = [
    `Stage instructions: ${untrusted("teacher_instructions", ctx.stage.instructions, 1500)}`,
    ctx.materialsExcerpt ? `Lesson material excerpt: ${untrusted("lesson_material", ctx.materialsExcerpt, 1500)}` : "",
    ctx.roles.length ? `Roles: ${ctx.roles.map((r) => `${r.member} — ${r.role}`).join(", ")}` : "",
    ctx.sharedIdeas.length ? `Ideas the group has shared:\n${ctx.sharedIdeas.map((i, n) => `${n + 1}. ${untrusted("student_idea", i, 300)}`).join("\n")}` : "",
    ctx.recentMessages.length ? `Recent group messages (oldest first):\n${ctx.recentMessages.map((m) => `${m.author}: ${untrusted("student_message", m.body, 300)}`).join("\n")}` : "",
  ].filter(Boolean);
  const task: Record<FacilitatorTrigger["kind"], string> = {
    stage_intro: "Introduce this stage: what to do and what a good outcome looks like, in plain words. If roles exist, a light reminder of how roles can help.",
    no_ideas_yet: "No ideas have been shared yet. Offer a gentle, low-pressure way to start (for example a sentence starter or a small first step). Make clear that a short or tentative idea is welcome.",
    ready_check: `The group has met this stage's requirements. Invite them to check they're happy, then confirm they're ready${ctx.nextStageTitle ? ` for "${ctx.nextStageTitle}"` : ""} using the ready button — or ask for more time if they need it.`,
    broaden_participation: "The chat has mostly been one voice recently. Without naming anyone, invite the group to hear a range of perspectives — e.g. take turns, or add to the board or say it aloud. Do not reprimand anyone.",
    refocus: "Recent messages seem to have drifted from the task. Gently reconnect the conversation to the learning goal with one focused question. Don't scold.",
    time_warning: `About ${trigger.kind === "time_warning" ? trigger.minutes : 2} minute(s) remain in this stage. Help the group prioritise what to finish. Reassure them nothing will be lost when time is up.`,
    ask:
      trigger.kind === "ask"
        ? {
            explain_task: "The group asked you to explain the task. Explain it accessibly, then suggest a first step.",
            discussion_question: "The group asked for a discussion question. Offer one or two open questions grounded in their ideas and the objective.",
            we_disagree: "The group says they disagree. Help them explore it respectfully: invite each view to be explained with reasons and evidence, and look for what they agree on. Don't pick a winner.",
            we_are_stuck: "The group says they're stuck. Offer a small next step or a guiding question — not the answer.",
            question: `The group asked: ${untrusted("student_question", trigger.question ?? "", 500)} — answer helpfully within your rules.`,
          }[trigger.quick]
        : "",
  };
  return `${parts.join("\n\n")}\n\nYour task: ${task[trigger.kind]}`;
}

export async function facilitatorMessage(trigger: FacilitatorTrigger, ctx: FacilitatorContext): Promise<AiResult<string>> {
  return runText({
    workflow: "facilitator",
    system: systemPrompt(ctx),
    messages: [{ role: "user", content: userPrompt(trigger, ctx) }],
    maxTokens: 350,
    simulate: () => simulateFacilitator(trigger, ctx),
  });
}

const pickOne = (seed: string, options: string[]) => options[stableIndex(seed, options.length)];

const STAGE_INTROS: Partial<Record<StageKind, string>> = {
  orientation: "Start by reading the task together. What will your group have made by the end?",
  role_selection: "Pick the roles that suit how each of you likes to work — you can hold more than one, and roles are there to help, not to limit what anyone does.",
  brainstorm: "This is quiet thinking time. Write your own ideas first — they stay private until the stage ends. A short or half-formed idea is completely fine.",
  synthesis: "Here's how your ideas group together. These themes are a suggestion — if something feels wrong, rename a theme or move an idea.",
  talk: "Screens down — it's talking time! Turn to each other and take turns sharing your ideas out loud. Make sure everyone gets a go.",
  discussion: "Time to talk it through, in the room or here. Try picking an idea that isn't yours and adding to it.",
  voting: "Place your votes on the ideas you think matter most. Talk about the result before moving on — a close vote is worth discussing.",
  creation: "Build your shared work together. Everyone can edit; your roles can help you share out the jobs.",
  physical: "Work together in the room. Tick off each check-in as you reach it, and capture a photo when you have something to show.",
  submission: "Check your work together. When you're happy, one person can submit it for the whole group.",
  presentation: "Presentation time. Listen for one thing you'd like to ask another group about.",
  reflection: "Look back on how your group worked together today.",
};

/** Deterministic, context-grounded messages used without a live AI. */
export function simulateFacilitator(trigger: FacilitatorTrigger, ctx: FacilitatorContext): string {
  const seed = `${ctx.stage.title}|${trigger.kind}|${ctx.sharedIdeas.length}|${ctx.recentMessages.length}`;
  const goal = ctx.objectives[0] ? `Remember the goal: ${lowerFirst(ctx.objectives[0])}.` : "";
  switch (trigger.kind) {
    case "stage_intro":
      return `${STAGE_INTROS[ctx.stage.kind] ?? `Welcome to “${ctx.stage.title}”.`}${ctx.roles.length && ctx.stage.kind !== "role_selection" ? " Your roles can help you share out the work." : ""}`;
    case "no_ideas_yet":
      return pickOne(seed, [
        "Not sure where to start? Try finishing this sentence: “One thing I noticed is… because…”. A short idea is a great start.",
        "Start small — one word or phrase that stood out to you is enough. You can add to it later.",
        "If you'd rather talk it through first, that's fine — jot down a few words afterwards so your idea is counted.",
      ]);
    case "ready_check":
      return `Nice work — you've done what this stage needs. When you're happy, tap “I'm ready”${ctx.nextStageTitle ? ` to move on to ${ctx.nextStageTitle}` : ""}. Need longer? Tap “More time”.`;
    case "broaden_participation":
      return pickOne(seed, [
        "Lots of good thinking here. Before you go further, could you hear from a couple of different perspectives? Taking turns — out loud, here, or on the board — all counts.",
        "Let's widen the conversation: what would someone who sees this differently say? Anyone can add a thought in whatever way suits them.",
      ]);
    case "refocus":
      return `Let's bring it back to the task: ${ctx.stage.instructions.split(/(?<=[.?!])\s/)[0] || ctx.stage.title} ${goal}`.trim();
    case "time_warning":
      return `About ${trigger.minutes} minute${trigger.minutes === 1 ? "" : "s"} left in this stage. What's the most important thing to finish? Don't worry — nothing is lost when the timer ends.`;
    case "ask": {
      if (trigger.quick === "explain_task") {
        const steps = ctx.stage.instructions.split(/(?<=[.?!])\s+/).filter(Boolean).slice(0, 3);
        return steps.length ? `Here's the task in short steps:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\nA good first step: agree who'll start.` : `Your task in this stage is “${ctx.stage.title}”. ${goal}`;
      }
      if (trigger.quick === "discussion_question") {
        const idea = ctx.sharedIdeas[stableIndex(seed, Math.max(1, ctx.sharedIdeas.length))];
        return idea
          ? `Try this: “${truncate(idea, 90)}” — what evidence supports it, and what might someone who disagrees say?`
          : `Try this: what's the most important thing to understand about “${ctx.stage.title}”, and why?`;
      }
      if (trigger.quick === "we_disagree") {
        return "Disagreeing is useful! Try this: each view gets one minute to explain its reasons and evidence, without interruption. Then ask: what do we agree on, and what would change our minds?";
      }
      if (trigger.quick === "we_are_stuck") {
        return `Let's take a smaller step. Look back at the instructions and pick just the first part. ${goal} What's one thing you already know that could help?`;
      }
      return `Good question. Here's a way to think about it: look back at the task (“${truncate(ctx.stage.instructions || ctx.stage.title, 80)}”) and ask what it needs you to show. What do you all think?`;
    }
  }
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
