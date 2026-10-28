import "server-only";
import { asServer, asUser, NotFoundError } from "@/lib/db";
import { publish, ch } from "@/lib/realtime/server";
import { rateLimit } from "@/lib/security/rate-limit";
import type { AccommodationKind } from "@/lib/domain/students";
import { QUICK_ACTIONS, tutorReply, type QuickAction, type TutorContext } from "@/lib/ai/tutor";
import { pipAvailableIn } from "@/lib/domain/lesson";
import { bannedWordHit, looksLikeNonsense, PIP_NOTES, PIP_REDIRECTS, ruleCheck, safeguardingConcern, type FlagCategory } from "@/lib/domain/moderation";
import { aiSettingsForSession } from "./ai-settings";
import { reviewChatMessage } from "@/lib/ai/chat-guard";
import { config as appConfig } from "@/lib/config";
import { raiseFlag } from "./flags";
import { conflict } from "@/lib/api";
import { studentContext } from "./sessions/student";

/**
 * One-to-one learning assistant (Pip). Other students never see a transcript;
 * the lesson's teacher can read it (each view is logged), and Pip's panel
 * tells students so.
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
  // Guardrails first: irrelevant, unkind or inappropriate questions are never sent to Pip.
  // (Worrying ones still go through, so the student gets a supportive answer and the teacher an alert.)
  const asked = text?.trim() ?? "";
  const settings = await aiSettingsForSession(sessionId);
  if (asked && !safeguardingConcern(asked)) {
    const pre = await asUser(uid, (db) => studentContext(db, uid, sessionId));
    const stage = pre.group ? pre.session.snapshot.stages[pre.group.stage_index] : pre.session.snapshot.stages[0];
    let block: keyof typeof PIP_NOTES | null = null;
    const rule = ruleCheck(asked);
    if (rule && rule !== "safeguarding") block = rule;
    else if (bannedWordHit(asked, settings.bannedWords)) block = "banned";
    else if (action === "question" && looksLikeNonsense(asked)) block = "nonsense";
    else if (action === "question" && asked.length > 3 && appConfig.aiMode === "live") {
      const v = await reviewChatMessage({ lesson: pre.session.snapshot.title, stage: stage?.title ?? "", instructions: stage?.instructions ?? "", recent: [], text: asked, teacherInstructions: settings.instructions }).catch(() => null);
      if (v && v.verdict !== "ok" && v.verdict !== "safeguarding") block = v.verdict;
    }
    if (block) {
      const flag: FlagCategory | null = block === "nonsense" ? null : block === "banned" ? "inappropriate" : block;
      if (flag) await raiseFlag({ sessionId, groupId: pre.group?.id ?? null, studentId: uid, source: "pip", category: flag, excerpt: asked }).catch(() => {});
      throw conflict(PIP_NOTES[block], "pip_not_sent");
    }
  }
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
  // Worrying messages get a supportive reply (not the tutor) and reach the teacher straight away.
  ctx.teacherInstructions = settings.instructions;
  ctx.bannedWords = settings.bannedWords;
  const category: FlagCategory | null = asked && safeguardingConcern(asked) ? "safeguarding" : null;
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


/** The teacher reads one student's Pip conversation in their lesson (logged). */
export async function teacherPipConversation(uid: string, sessionId: string, studentId: string) {
  return asUser(uid, async (db) => {
    const s = await db.maybeOne("select 1 from activity_sessions where id = $1 and teacher_id = $2", [sessionId, uid]);
    if (!s) throw new NotFoundError();
    const rows = await db.query<{ id: string; role: string; action: string; origin: string | null; body: string; created_at: Date }>(
      "select id, role, action, origin, body, created_at from private_ai_messages where session_id = $1 and student_id = $2 order by created_at limit 300",
      [sessionId, studentId],
    );
    await db.query("insert into audit_events(actor_id, session_id, action, target) values ($1,$2,'pip.viewed',$3)", [uid, sessionId, studentId]);
    return rows.map((r) => ({ id: r.id, role: r.role, action: r.action, origin: r.origin, body: r.body, createdAt: r.created_at.toISOString() }));
  });
}
