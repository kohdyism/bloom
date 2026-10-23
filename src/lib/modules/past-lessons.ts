import "server-only";
import { asUser } from "@/lib/db";
import { isFlowerId, type FlowerId } from "@/lib/domain/flowers";

export type PastLesson = { id: string; title: string; className: string; endedAt: string | null; groupName: string | null; flower: FlowerId | null; reflected: boolean };

/** Every lesson this student took part in that has ended, newest first. */
export async function pastLessons(uid: string): Promise<PastLesson[]> {
  const rows = await asUser(uid, (db) =>
    db.query<{ id: string; title: string; class_name: string; ended_at: Date | null; group_name: string | null; flower: string | null; reflected: boolean }>(
      `select s.id, s.snapshot ->> 'title' as title, c.name as class_name, s.ended_at,
              g.name as group_name, g.flower,
              exists (select 1 from reflection_responses r where r.session_id = s.id and r.student_id = $1) as reflected
       from session_participants p
       join activity_sessions s on s.id = p.session_id
       join classes c on c.id = s.class_id
       left join group_members gm on gm.session_id = s.id and gm.student_id = $1
       left join session_groups g on g.id = gm.group_id
       where p.student_id = $1 and s.status = 'ended'
       order by s.ended_at desc nulls last limit 100`,
      [uid],
    ),
  );
  return rows.map((r) => ({ id: r.id, title: r.title, className: r.class_name, endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null, groupName: r.group_name, flower: isFlowerId(r.flower) ? r.flower : null, reflected: r.reflected }));
}

/** The student's own reflection and private note for one lesson. */
export async function myLookBack(uid: string, sessionId: string) {
  return asUser(uid, async (db) => {
    const reflection = await db.maybeOne<{ ratings: Record<string, number>; answers: Record<string, string>; submitted_at: Date }>(
      "select ratings, answers, submitted_at from reflection_responses where session_id = $1 and student_id = $2",
      [sessionId, uid],
    );
    const note = await db.maybeOne<{ body: string; updated_at: Date }>("select body, updated_at from student_lesson_notes where session_id = $1 and student_id = $2", [sessionId, uid]);
    return {
      reflection: reflection ? { ratings: reflection.ratings, answers: reflection.answers, submittedAt: new Date(reflection.submitted_at).toISOString() } : null,
      note: note ? { body: note.body, updatedAt: new Date(note.updated_at).toISOString() } : null,
    };
  });
}

/** Save the student's private "looking back" note (only they can see it). */
export async function saveLookBackNote(uid: string, sessionId: string, body: string) {
  const text = body.slice(0, 2000);
  await asUser(uid, async (db) => {
    const ok = await db.maybeOne("select 1 from session_participants where session_id = $1 and student_id = $2", [sessionId, uid]);
    if (!ok) throw new Error("You weren't part of that lesson.");
    await db.query(
      `insert into student_lesson_notes(student_id, session_id, body) values ($1,$2,$3)
       on conflict (student_id, session_id) do update set body = excluded.body, updated_at = now()`,
      [uid, sessionId, text],
    );
  });
}
