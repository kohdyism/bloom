import "server-only";
import { asUser, NotFoundError } from "@/lib/db";
import { CRITERIA, LEVELS, reviewContribution } from "@/lib/ai/contribution-review";
import { snapshotGroupWork } from "./artifacts";
import { sessionSnapshotSchema } from "@/lib/domain/lesson";
import { reflectionFor } from "@/lib/domain/reflection";

/**
 * One student's progress across the teacher's lessons, for parent–teacher
 * meetings: participation, help asked for, how they rated their own
 * experience, and what they wrote in their reflections. Opening it is logged.
 */
export async function studentProgress(uid: string, studentId: string) {
  return asUser(uid, async (db) => {
    const p = await db.maybeOne<{ id: string; display_name: string }>("select id, display_name from profiles where id = $1 and role = 'student'", [studentId]);
    const teaches = (await db.maybeOne<{ ok: boolean }>("select private.teaches_student($1) as ok", [studentId]))?.ok;
    if (!p || !teaches) throw new NotFoundError();
    const sessions = await db.query<{ id: string; snapshot: unknown; started_at: Date | null; created_at: Date; ended_at: Date | null; class_name: string }>(
      `select s.id, s.snapshot, s.started_at, s.created_at, s.ended_at, c.name as class_name
       from session_participants sp join activity_sessions s on s.id = sp.session_id join classes c on c.id = s.class_id
       where sp.student_id = $1 and s.teacher_id = $2 and s.status <> 'lobby'
       order by coalesce(s.started_at, s.created_at)`,
      [studentId, uid],
    );
    const lessons = [];
    for (const s of sessions) {
      const snap = sessionSnapshotSchema.parse(s.snapshot);
      const group = await db.maybeOne<{ id: string; name: string; stage_index: number; stage_status: string }>(
        "select g.id, g.name, g.stage_index, g.stage_status from group_members gm join session_groups g on g.id = gm.group_id where gm.session_id = $1 and gm.student_id = $2",
        [s.id, studentId],
      );
      const counts = group ? await db.one<{ ideas: string; messages: string; votes: string; edits: string }>(
        `select (select count(*) from individual_ideas where group_id = $1 and author_id = $2 and status = 'submitted') as ideas,
                (select count(*) from group_messages where group_id = $1 and author_id = $2 and kind = 'student') as messages,
                (select count(*) from votes where group_id = $1 and voter_id = $2) as votes,
                (select count(*) from artifact_updates u join collaborative_artifacts a on a.id = u.artifact_id where a.group_id = $1 and u.author_id = $2) as edits`,
        [group.id, studentId],
      ) : { ideas: "0", messages: "0", votes: "0", edits: "0" };
      const help = await db.query<{ reason: string }>("select reason from help_requests where session_id = $1 and student_id = $2 order by created_at", [s.id, studentId]);
      const reflection = await db.maybeOne<{ ratings: Record<string, number>; answers: Record<string, string> }>(
        "select ratings, answers from reflection_responses where session_id = $1 and student_id = $2",
        [s.id, studentId],
      );
      const set = reflectionFor(snap.config);
      const review = await db.maybeOne<{ criteria: StoredCriterion[]; summary: string; evidence: string[]; origin: string; status: string; teacher_note: string }>(
        "select criteria, summary, evidence, origin, status, teacher_note from contribution_reviews where session_id = $1 and student_id = $2",
        [s.id, studentId],
      );
      lessons.push({
        review: review ? { criteria: review.criteria, summary: review.summary, evidence: review.evidence, origin: review.origin, confirmed: review.status === "confirmed", note: review.teacher_note } : null,
        sessionId: s.id,
        title: snap.title,
        className: s.class_name,
        date: (s.started_at ?? s.created_at).toISOString(),
        ended: !!s.ended_at,
        groupName: group?.name ?? null,
        stagesDone: group ? (group.stage_status === "complete" ? snap.stages.length : group.stage_index) : 0,
        totalStages: snap.stages.length,
        ideas: Number(counts.ideas), messages: Number(counts.messages), votes: Number(counts.votes), edits: Number(counts.edits),
        help: help.map((h) => h.reason),
        reflection: reflection ? {
          ratings: set.ratings.map((q) => ({ key: q.key, question: q.question, low: q.low, high: q.high, value: reflection.ratings[q.key] ?? null })),
          answers: set.questions.map((q) => ({ key: q.key, question: q.question, text: reflection.answers[q.key] ?? "" })).filter((a) => a.text.trim()),
        } : null,
      });
    }
    await db.query("insert into audit_events(actor_id, action, target) values ($1, 'student_report.viewed', $2)", [uid, studentId]);
    return { student: { id: p.id, name: p.display_name }, lessons, generatedAt: new Date().toISOString() };
  });
}
export type StudentProgress = Awaited<ReturnType<typeof studentProgress>>;

export type StoredCriterion = { key: string; label: string; level: number | null; reason: string };

/** Collect the plain text inside the group's shared work (document, slides, whiteboard), as context. */
function workText(content: unknown): string {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (out.join(" ").length > 1500) return;
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if ((k === "text") && typeof x === "string") out.push(x); else if (k !== "html") walk(x); }
  };
  walk(content);
  return out.join("\n").slice(0, 1500);
}

/** Ask the AI for a suggested rating of one student's written contributions in one lesson (teacher only). */
export async function suggestContributionReview(uid: string, sessionId: string, studentId: string) {
  const input = await asUser(uid, async (db) => {
    const s = await db.maybeOne<{ snapshot: unknown }>("select snapshot from activity_sessions where id = $1 and teacher_id = $2", [sessionId, uid]);
    if (!s) throw new NotFoundError();
    const snap = sessionSnapshotSchema.parse(s.snapshot);
    const group = await db.maybeOne<{ id: string }>("select g.id from group_members gm join session_groups g on g.id = gm.group_id where gm.session_id = $1 and gm.student_id = $2", [sessionId, studentId]);
    if (!group) throw new NotFoundError();
    const ideas = await db.query<{ body: string; builds_on: string | null }>("select body, builds_on from individual_ideas where group_id = $1 and author_id = $2 and status = 'submitted' order by created_at", [group.id, studentId]);
    const messages = await db.query<{ body: string }>("select body from group_messages where group_id = $1 and author_id = $2 and kind = 'student' order by created_at limit 60", [group.id, studentId]);
    const reflection = await db.maybeOne<{ answers: Record<string, string> }>("select answers from reflection_responses where session_id = $1 and student_id = $2", [sessionId, studentId]);
    const edits = await db.one<{ n: string }>("select count(*) as n from artifact_updates u join collaborative_artifacts a on a.id = u.artifact_id where a.group_id = $1 and u.author_id = $2", [group.id, studentId]);
    return {
      lessonTitle: snap.title, objectives: snap.objectives,
      tasks: snap.stages.filter((x) => x.instructions.trim()).map((x) => `${x.title}: ${x.instructions}`),
      ideas: ideas.map((i) => ({ text: i.body, buildsOnOthers: !!i.builds_on })),
      messages: messages.map((m) => m.body),
      reflection: Object.values(reflection?.answers ?? {}),
      groupWorkExcerpt: workText(await snapshotGroupWork(db, group.id)),
      edits: Number(edits.n),
    };
  });
  const res = await reviewContribution(input);
  const criteria: StoredCriterion[] = CRITERIA.map((c) => ({ key: c.key, label: c.label, level: res.data[c.key].level, reason: res.data[c.key].reason.slice(0, 300) }));
  await asUser(uid, (db) => db.query(
    `insert into contribution_reviews(session_id, student_id, teacher_id, criteria, summary, evidence, origin, status, teacher_note, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,'suggested','', now())
     on conflict (session_id, student_id) do update set criteria = excluded.criteria, summary = excluded.summary, evidence = excluded.evidence,
       origin = excluded.origin, status = 'suggested', updated_at = now()`,
    [sessionId, studentId, uid, JSON.stringify(criteria), res.data.summary.slice(0, 600), JSON.stringify(res.data.evidence.slice(0, 3)), res.origin],
  ));
}

/** The teacher checks the suggestion (changing any level) and confirms it for the printed report. */
export async function confirmContributionReview(uid: string, sessionId: string, studentId: string, levels: Record<string, number | null>, note: string) {
  await asUser(uid, async (db) => {
    const row = await db.maybeOne<{ criteria: StoredCriterion[] }>("select criteria from contribution_reviews where session_id = $1 and student_id = $2 and teacher_id = $3", [sessionId, studentId, uid]);
    if (!row) throw new NotFoundError();
    const criteria = row.criteria.map((c) => {
      const v = levels[c.key];
      return { ...c, level: v === null || (typeof v === "number" && v >= 1 && v <= LEVELS.length) ? v : c.level };
    });
    await db.query(
      "update contribution_reviews set criteria = $3, teacher_note = $4, status = 'confirmed', updated_at = now() where session_id = $1 and student_id = $2",
      [sessionId, studentId, JSON.stringify(criteria), note.trim().slice(0, 1000)],
    );
    await db.query("insert into audit_events(actor_id, session_id, action, target) values ($1,$2,'contribution_review.confirmed',$3)", [uid, sessionId, studentId]);
  });
}
