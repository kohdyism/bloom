import "server-only";
import { asServer, asUser } from "@/lib/db";
import { publish, ch } from "@/lib/realtime/server";
import { rateLimit } from "@/lib/security/rate-limit";
import type { AccommodationKind } from "@/lib/domain/students";
import { QUICK_ACTIONS, tutorReply, type QuickAction, type TutorContext } from "@/lib/ai/tutor";
import { pipAvailableIn } from "@/lib/domain/lesson";
import { bannedWordHit, PIP_REDIRECTS, ruleCheck, type FlagCategory } from "@/lib/domain/moderation";
import { aiSettingsForSession } from "./ai-settings";
import { reviewChatMessage } from "@/lib/ai/chat-guard";
import { config as appConfig } from "@/lib/config";
import { raiseFlag } from "./flags";
import { conflict } from "@/lib/api";
import { studentContext } from "./sessions/student";

/**
 * Private learning assistant. Transcripts are readable only by the student
 * (RLS has no teacher policy). Teachers see aggregate counts by action via
 * public.private_ai_usage().
 */
export async function privateConversation(uid: string, sessionId: string) {
  return asUser(uid, async (db) => {
    await studentContext(db, uid, sessionId);
    const rows = await db.query<{ id: string; role: string; action: string; origin: string | null; body: string; created_at: Date }>(
      "select id, role, action, origin, body, created_at from private_ai_messages where student_id = $1 and session_id = $2 order by created_at limit 300",
      [uid, sessionId],
    );
    return rows.map((r) => ({ id: r.id, role: r.role, action: r.action, origin: r.origin, body: r.body, createdAt: r.created_at.toISOString() }));
  });
}

const PREF_TEXT: Record<string, Record<string, string>> = {
  communication: { write: "likes to write ideas down before sharing" },
  structure: { structured: "prefers clear, step-by-step structure" },
  examples: { yes: "finds examples helpful" },
  visuals: { yes: "finds visual explanations helpful (describe layouts or diagrams in words)" },
  thinkingTime: { yes: "likes quiet thinking time — don't rush them" },
};

export async function askPrivateAssistant(uid: string, sessionId: string, action: QuickAction | "question", text: string | undefined) {
  if (action === "question" && !text?.trim()) throw new Error("Type a question first.");
  await rateLimit(`tutor:${uid}`, 30, 600);
  const ctx = await asUser(uid, async (db) => {
    const { session, group } = await studentContext(db, uid, sessionId);
    // The teacher decides when Pip is available; face-to-face stages never have it.
    if (!pipAvailableIn(group ? session.snapshot.stages[group.stage_index] : null, session.snapshot.config)) {
      throw conflict("Pip isn't available right now. Your teacher has switched it off for this part of the lesson.");
    }
    await db.query(
      "insert into private_ai_messages(student_id, session_id, role, action, body) values ($1,$2,'student',$3,$4)",
      [uid, sessionId, action, action === "question" ? text!.trim().slice(0, 2000) : `${QUICK_ACTIONS[action]}${text?.trim() ? `: ${text.trim().slice(0, 1000)}` : ""}`],
    );
    const stage = group ? session.snapshot.stages[group.stage_index] : session.snapshot.stages[0];
    const myIdeas = group ? await db.query<{ body: string }>("select body from individual_ideas where group_id = $1 and author_id = $2 order by created_at", [group.id, uid]) : [];
    const groupIdeas = group ? await db.query<{ body: string }>("select body from individual_ideas where group_id = $1 and shared and author_id <> $2 order by created_at limit 20", [group.id, uid]) : [];
    const members = group ? await db.query<{ student_id: string }>("select student_id from group_members where group_id = $1 order by student_id", [group.id]) : [];
    const alias = new Map(members.map((m, i) => [m.student_id, m.student_id === uid ? "You" : `Groupmate ${String.fromCharCode(65 + i)}`]));
    const discussion = group
      ? await db.query<{ author_id: string | null; kind: string; body: string }>(
          "select author_id, kind, body from (select * from group_messages where group_id = $1 and kind in ('student','teacher') order by created_at desc limit 10) m order by created_at",
          [group.id],
        )
      : [];
    const prefs = await db.maybeOne<{ survey: Record<string, string> }>("select survey from student_preferences where student_id = $1", [uid]);
    const supports = await db.query<{ kind: AccommodationKind }>("select kind from student_accommodations where student_id = $1", [uid]);
    const history = await db.query<{ role: "student" | "assistant"; body: string }>(
      "select role, body from (select role, body, created_at from private_ai_messages where student_id = $1 and session_id = $2 order by created_at desc limit 9) h order by created_at",
      [uid, sessionId],
    );
    const preferences = [
      ...Object.entries(prefs?.survey ?? {}).map(([k, v]) => PREF_TEXT[k]?.[v]).filter((x): x is string => !!x),
      // Functional supports are passed to this student's own assistant only, as preferences — never labels.
      ...supports.map((s) => ({
        task_breakdown: "give tasks as short numbered steps",
        written_instructions: "write instructions out clearly",
        extra_processing_time: "keep replies short and allow time to think",
        explicit_turn_taking: "suggest clear, simple ways to take a turn in the group",
        reduced_sensory: "keep formatting calm and minimal",
        smaller_groups: "",
      })[s.kind]).filter(Boolean),
    ];
    const context: TutorContext & { groupId: string | null } = {
      groupId: group?.id ?? null,
      lessonTitle: session.snapshot.title,
      objectives: session.snapshot.objectives,
      subject: session.snapshot.subject,
      stage: { kind: stage?.kind ?? "orientation", title: stage?.title ?? session.snapshot.title, instructions: stage?.instructions ?? session.snapshot.description },
      materialsExcerpt: session.snapshot.materials.map((m) => `${m.title}: ${m.body}`).join("\n").slice(0, 2500),
      myIdeas: myIdeas.map((i) => i.body),
      groupIdeas: groupIdeas.map((i) => i.body),
      recentDiscussion: discussion.map((m) => ({ author: m.kind === "teacher" ? "Teacher" : alias.get(m.author_id ?? "") ?? "Groupmate", body: m.body })),
      preferences,
      level: session.snapshot.config.assistanceLevel,
      history: history.slice(0, -1),
    };
    return context;
  });
  // Guardrails: Pip only helps with the task. Off-task, unkind or inappropriate questions get a
  // kind redirect instead of an answer, and worrying ones are passed to the teacher straight away.
  const asked = text?.trim() ?? "";
  const settings = await aiSettingsForSession(sessionId);
  ctx.teacherInstructions = settings.instructions;
  ctx.bannedWords = settings.bannedWords;
  let category: FlagCategory | null = asked ? ruleCheck(asked) : null;
  if (!category && asked && bannedWordHit(asked, settings.bannedWords)) category = "inappropriate";
  if (!category && action === "question" && asked.length > 3 && appConfig.aiMode === "live") {
    const verdict = await reviewChatMessage({ lesson: ctx.lessonTitle, stage: ctx.stage.title, instructions: ctx.stage.instructions, recent: [], text: asked, teacherInstructions: settings.instructions }).catch(() => null);
    if (verdict && verdict.verdict !== "ok") category = verdict.verdict;
  }
  if (category) {
    const redirect = PIP_REDIRECTS[category];
    await asServer((db) =>
      db.query("insert into private_ai_messages(student_id, session_id, role, action, origin, body) values ($1,$2,'assistant',$3,'offline_helper',$4)", [uid, sessionId, action, redirect]),
    );
    await raiseFlag({ sessionId, groupId: ctx.groupId, studentId: uid, source: "pip", category, excerpt: asked }).catch(() => {});
    await publish([{ channel: ch.user(uid), event: "private_ai.new" }, { channel: ch.teacher(sessionId), event: "ai_usage.updated" }]);
    return { reply: redirect, origin: "offline_helper" as const };
  }
  const reply = await tutorReply(ctx, { action, text });
  await asServer((db) =>
    db.query("insert into private_ai_messages(student_id, session_id, role, action, origin, body) values ($1,$2,'assistant',$3,$4,$5)", [uid, sessionId, action, reply.origin, reply.data.slice(0, 6000)]),
  );
  await publish([{ channel: ch.user(uid), event: "private_ai.new" }, { channel: ch.teacher(sessionId), event: "ai_usage.updated" }]);
  return { reply: reply.data, origin: reply.origin };
}

