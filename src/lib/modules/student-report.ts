import "server-only";
import { asUser, NotFoundError } from "@/lib/db";
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
      lessons.push({
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
