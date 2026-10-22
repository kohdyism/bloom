import "server-only";
import { asUser, NotFoundError } from "@/lib/db";
import { REFLECTION_QUESTIONS, REFLECTION_RATINGS } from "@/lib/domain/reflection";
import { reflectionThemes, reportSchema, summariseLesson, type ReportFacts, type ReportSummary } from "@/lib/ai/report";
import { loadSession } from "./sessions/common";

const REASON_LABELS: Record<string, string> = {
  dont_understand: "Didn't understand the task",
  need_time: "Needed more time",
  group_help: "Help with group",
  speak_to_teacher: "Wanted to speak to the teacher",
  uncomfortable: "Something made them uncomfortable",
  other: "Other",
};
export { REASON_LABELS };

export async function listReports(uid: string) {
  return asUser(uid, async (db) => {
    const rows = await db.query<{ id: string; status: string; title: string; class_name: string; started_at: Date | null; ended_at: Date | null; created_at: Date; reflections: string; participants: string }>(
      `select s.id, s.status, s.snapshot ->> 'title' as title, c.name as class_name, s.started_at, s.ended_at, s.created_at,
              (select count(*) from reflection_responses r where r.session_id = s.id) as reflections,
              (select count(*) from session_participants p where p.session_id = s.id) as participants
       from activity_sessions s join classes c on c.id = s.class_id
       where s.teacher_id = $1 order by s.created_at desc limit 100`,
      [uid],
    );
    return rows.map((r) => ({ id: r.id, status: r.status, title: r.title, className: r.class_name, startedAt: r.started_at?.toISOString() ?? null, endedAt: r.ended_at?.toISOString() ?? null, createdAt: r.created_at.toISOString(), reflections: Number(r.reflections), participants: Number(r.participants) }));
  });
}

export async function lessonReport(uid: string, sessionId: string, opts: { regenerate?: boolean } = {}) {
  const facts = await asUser(uid, async (db) => {
    const s = await loadSession(db, sessionId);
    if (!s || s.teacher_id !== uid) throw new NotFoundError();
    const enrolled = await db.one<{ n: string }>("select count(*) as n from class_memberships where class_id = $1", [s.class_id]);
    const participants = await db.query<{ student_id: string; display_name: string }>(
      "select sp.student_id, p.display_name from session_participants sp join profiles p on p.id = sp.student_id where sp.session_id = $1 order by p.display_name",
      [sessionId],
    );
    const groups = await db.query<{ id: string; name: string; stage_index: number; stage_status: string }>("select id, name, stage_index, stage_status from session_groups where session_id = $1 order by position", [sessionId]);
    const groupDetails = [];
    for (const [i, g] of groups.entries()) {
      const members = await db.query<{ display_name: string }>("select p.display_name from group_members gm join profiles p on p.id = gm.student_id where gm.group_id = $1 order by p.display_name", [g.id]);
      const ext = await db.one<{ s: string | null }>("select sum((details ->> 'seconds')::int) as s from audit_events where session_id = $1 and action = 'group.extended' and target = $2", [sessionId, g.id]);
      const help = await db.query<{ reason: string; n: string }>("select reason, count(*) as n from help_requests where group_id = $1 group by reason", [g.id]);
      const counts = await db.one<{ ideas: string; messages: string }>(
        "select (select count(*) from individual_ideas where group_id = $1 and shared) as ideas, (select count(*) from group_messages where group_id = $1 and kind = 'student') as messages",
        [g.id],
      );
      const subs = await db.query<{ id: string; version: number; status: string; created_at: Date; feedback: string }>("select id, version, status, created_at, feedback from submissions where group_id = $1 order by version desc", [g.id]);
      const roles = await db.query<{ display_name: string; role_key: string }>("select p.display_name, r.role_key from group_roles r join profiles p on p.id = r.student_id where r.group_id = $1", [g.id]);
      const completed = g.stage_status === "complete" ? s.snapshot.stages.length : g.stage_index;
      groupDetails.push({
        ref: `Group ${i + 1}`,
        id: g.id,
        name: g.name,
        members: members.map((m) => m.display_name),
        roles: roles.map((r) => ({ name: r.display_name, role: s.snapshot.config.roles.find((x) => x.key === r.role_key)?.name ?? r.role_key })),
        stagesCompleted: completed,
        totalStages: s.snapshot.stages.length,
        extensionsSeconds: Number(ext.s ?? 0),
        helpRequests: Object.fromEntries(help.map((h) => [h.reason, Number(h.n)])),
        submitted: subs.length > 0,
        submissions: subs.map((x) => ({ id: x.id, version: x.version, status: x.status, createdAt: x.created_at.toISOString(), feedback: x.feedback })),
        ideasShared: Number(counts.ideas),
        messages: Number(counts.messages),
      });
    }
    const reflections = await db.query<{ id: string; student_id: string; ratings: Record<string, number>; answers: Record<string, string> }>(
      "select id, student_id, ratings, answers from reflection_responses where session_id = $1",
      [sessionId],
    );
    const averages: Record<string, number | null> = {};
    const distributions: Record<string, number[]> = {};
    for (const r of REFLECTION_RATINGS) {
      const vals = reflections.map((x) => x.ratings[r.key]).filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
      averages[r.key] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
      distributions[r.key] = [1, 2, 3, 4, 5].map((n) => vals.filter((v) => v === n).length);
    }
    const freeText = reflections.flatMap((r) => REFLECTION_QUESTIONS.map((q) => r.answers[q.key]).filter((t): t is string => !!t && t.trim().length > 2));
    const help = await db.query<{ reason: string; n: string }>("select reason, count(*) as n from help_requests where session_id = $1 group by reason", [sessionId]);
    const ai = await db.query<{ action: string; request_count: string }>("select action, sum(request_count) as request_count from public.private_ai_usage($1) group by action", [sessionId]);
    const existing = await db.maybeOne<{ summary: ReportSummary; origin: string; created_at: Date }>("select summary, origin, created_at from lesson_reports where session_id = $1", [sessionId]);
    const start = s.started_at ?? s.created_at;
    const end = s.ended_at ?? new Date();
    return {
      session: s, enrolled: Number(enrolled.n), participants, groupDetails, reflections, averages, distributions, freeText, existing,
      help: help.map((h) => ({ reason: h.reason, label: REASON_LABELS[h.reason] ?? h.reason, count: Number(h.n) })),
      aiUsage: ai.map((a) => ({ action: a.action, count: Number(a.request_count) })),
      durationMinutes: Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)),
    };
  });

  let summary = facts.existing?.summary ?? null;
  let origin = facts.existing?.origin ?? null;
  const canSummarise = facts.session.status === "ended";
  if (canSummarise && (!summary || opts.regenerate)) {
    const input: ReportFacts = {
      lessonTitle: facts.session.snapshot.title,
      durationMinutes: facts.durationMinutes,
      attendance: facts.participants.length,
      enrolled: facts.enrolled,
      groups: facts.groupDetails.map((g) => ({ ref: g.ref, stagesCompleted: g.stagesCompleted, totalStages: g.totalStages, extensionsSeconds: g.extensionsSeconds, helpRequests: g.helpRequests, submitted: g.submitted, ideasShared: g.ideasShared, messages: g.messages })),
      reflection: { responses: facts.reflections.length, averages: facts.averages, freeText: facts.freeText },
    };
    const res = await summariseLesson(input);
    summary = reportSchema.parse(res.data);
    origin = res.origin;
    await asUser(uid, (db) =>
      db.query(
        `insert into lesson_reports(session_id, summary, origin) values ($1,$2,$3)
         on conflict (session_id) do update set summary = excluded.summary, origin = excluded.origin, created_at = now()`,
        [sessionId, JSON.stringify(summary), origin],
      ),
    );
  }

  const nameById = new Map(facts.participants.map((p) => [p.student_id, p.display_name]));
  return {
    sessionId,
    title: facts.session.snapshot.title,
    status: facts.session.status,
    startedAt: facts.session.started_at?.toISOString() ?? null,
    endedAt: facts.session.ended_at?.toISOString() ?? null,
    durationMinutes: facts.durationMinutes,
    attendance: facts.participants.length,
    enrolled: facts.enrolled,
    stages: facts.session.snapshot.stages.map((s) => ({ kind: s.kind, title: s.title })),
    groups: facts.groupDetails,
    reflection: {
      responses: facts.reflections.length,
      averages: facts.averages,
      distributions: facts.distributions,
      themes: reflectionThemes(facts.freeText),
      // Names + ids only; the content is opened deliberately via individualReflection().
      respondents: facts.reflections.map((r) => ({ id: r.id, name: nameById.get(r.student_id) ?? "Student" })).sort((a, b) => a.name.localeCompare(b.name)),
    },
    help: facts.help,
    aiUsage: facts.aiUsage,
    summary,
    summaryOrigin: origin,
  };
}
export type LessonReport = Awaited<ReturnType<typeof lessonReport>>;

/** Deliberate, audited drill-down into one student's reflection. */
export async function individualReflection(uid: string, sessionId: string, responseId: string) {
  return asUser(uid, async (db) => {
    const row = await db.maybeOne<{ student_id: string; ratings: Record<string, number>; answers: Record<string, string>; submitted_at: Date }>(
      "select r.student_id, r.ratings, r.answers, r.submitted_at from reflection_responses r join activity_sessions s on s.id = r.session_id where r.id = $1 and s.id = $2 and s.teacher_id = $3",
      [responseId, sessionId, uid],
    );
    if (!row) throw new NotFoundError();
    const p = await db.one<{ display_name: string }>("select display_name from profiles where id = $1", [row.student_id]);
    await db.query("insert into audit_events(actor_id, session_id, action, target) values ($1,$2,'reflection.viewed',$3)", [uid, sessionId, responseId]);
    return { name: p.display_name, ratings: row.ratings, answers: row.answers, submittedAt: row.submitted_at.toISOString() };
  });
}

export function reportToCsv(r: LessonReport): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["Lesson", r.title].map(esc).join(","),
    ["Duration (min)", r.durationMinutes].map(esc).join(","),
    ["Attendance", `${r.attendance}/${r.enrolled}`].map(esc).join(","),
    "",
    ["Group", "Members", "Stages completed", "Total stages", "Extra time (min)", "Help requests", "Ideas shared", "Written messages", "Submitted"].map(esc).join(","),
    ...r.groups.map((g) => [g.name, g.members.join("; "), g.stagesCompleted, g.totalStages, Math.round(g.extensionsSeconds / 60), Object.values(g.helpRequests).reduce((a, b) => a + b, 0), g.ideasShared, g.messages, g.submitted ? "yes" : "no"].map(esc).join(",")),
    "",
    ["Reflection item", "Average (1-5)", "Responses"].map(esc).join(","),
    ...REFLECTION_RATINGS.map((q) => [q.question, r.reflection.averages[q.key] ?? "", r.reflection.distributions[q.key]?.reduce((a, b) => a + b, 0) ?? 0].map(esc).join(",")),
  ];
  return lines.join("\n");
}
