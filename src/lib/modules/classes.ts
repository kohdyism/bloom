import "server-only";
import { z } from "zod";
import { asUser, NotFoundError } from "@/lib/db";
import { provisionStudentAccount } from "@/lib/auth/provision";
import { ACCOMMODATION_KINDS, type AccommodationKind, type Survey } from "@/lib/domain/students";

export type ClassSummary = { id: string; name: string; subject: string; yearLevel: string; studentCount: number; lessonCount: number };

export async function listClasses(uid: string): Promise<ClassSummary[]> {
  return asUser(uid, async (db) => {
    const rows = await db.query<{ id: string; name: string; subject: string; year_level: string; students: string; lessons: string }>(
      `select c.id, c.name, c.subject, c.year_level,
              (select count(*) from class_memberships m where m.class_id = c.id) as students,
              (select count(*) from lessons l where l.class_id = c.id) as lessons
       from classes c where c.teacher_id = $1 and not c.archived order by c.created_at`,
      [uid],
    );
    return rows.map((r) => ({ id: r.id, name: r.name, subject: r.subject, yearLevel: r.year_level, studentCount: Number(r.students), lessonCount: Number(r.lessons) }));
  });
}

export const classInput = z.object({
  name: z.string().trim().min(1, "Give the class a name.").max(120),
  subject: z.string().trim().max(80).default(""),
  yearLevel: z.string().trim().max(40).default(""),
});

export async function createClass(uid: string, input: z.infer<typeof classInput>) {
  return asUser(uid, (db) =>
    db.one<{ id: string }>(
      "insert into classes(teacher_id, name, subject, year_level) values ($1,$2,$3,$4) returning id",
      [uid, input.name, input.subject, input.yearLevel],
    ),
  );
}

export type ClassStudent = {
  id: string; displayName: string; username: string; avatarColor: string; onboarded: boolean; accommodationCount: number;
};

export async function getClass(uid: string, classId: string) {
  return asUser(uid, async (db) => {
    const cls = await db.maybeOne<{ id: string; name: string; subject: string; year_level: string }>(
      "select id, name, subject, year_level from classes where id = $1 and teacher_id = $2",
      [classId, uid],
    );
    if (!cls) throw new NotFoundError();
    const students = await db.query<{ id: string; display_name: string; username: string; avatar_color: string; onboarded_at: Date | null; acc: string }>(
      `select p.id, p.display_name, p.username, p.avatar_color, p.onboarded_at,
              (select count(*) from student_accommodations a where a.student_id = p.id) as acc
       from class_memberships m join profiles p on p.id = m.student_id
       where m.class_id = $1 order by p.display_name`,
      [classId],
    );
    const constraints = await db.query<{ id: string; kind: string; student_a: string; student_b: string }>(
      "select id, kind, student_a, student_b from grouping_constraints where class_id = $1 order by created_at",
      [classId],
    );
    const lessons = await db.query<{ id: string; title: string; updated_at: Date }>(
      "select id, title, updated_at from lessons where class_id = $1 order by updated_at desc",
      [classId],
    );
    return {
      id: cls.id,
      name: cls.name,
      subject: cls.subject,
      yearLevel: cls.year_level,
      students: students.map<ClassStudent>((s) => ({
        id: s.id, displayName: s.display_name, username: s.username, avatarColor: s.avatar_color,
        onboarded: s.onboarded_at !== null, accommodationCount: Number(s.acc),
      })),
      constraints: constraints.map((c) => ({ id: c.id, kind: c.kind as "keep_apart" | "keep_together", studentA: c.student_a, studentB: c.student_b })),
      lessons: lessons.map((l) => ({ id: l.id, title: l.title, updatedAt: l.updated_at.toISOString() })),
    };
  });
}

export const enrolInput = z.object({
  displayName: z.string().trim().min(1, "Enter the student's name.").max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, "3–40 characters: lowercase letters, numbers, dots, dashes."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

export async function enrolStudent(uid: string, classId: string, input: z.infer<typeof enrolInput>) {
  // Authorise first: only the class teacher may enrol (checked through RLS).
  const owns = await asUser(uid, (db) => db.maybeOne("select 1 from classes where id = $1 and teacher_id = $2", [classId, uid]));
  if (!owns) throw new NotFoundError();
  const studentId = await provisionStudentAccount(input);
  await asUser(uid, (db) => db.query("insert into class_memberships(class_id, student_id) values ($1,$2)", [classId, studentId]));
  return studentId;
}

export async function removeStudent(uid: string, classId: string, studentId: string) {
  await asUser(uid, (db) => db.query("delete from class_memberships where class_id = $1 and student_id = $2", [classId, studentId]));
}

export async function addConstraint(uid: string, classId: string, input: { kind: "keep_apart" | "keep_together"; studentA: string; studentB: string }) {
  if (input.studentA === input.studentB) throw new Error("Choose two different students.");
  const [a, b] = [input.studentA, input.studentB].sort();
  await asUser(uid, (db) =>
    db.query(
      `insert into grouping_constraints(class_id, kind, student_a, student_b) values ($1,$2,$3,$4)
       on conflict (class_id, student_a, student_b) do update set kind = excluded.kind`,
      [classId, input.kind, a, b],
    ),
  );
}

export async function removeConstraint(uid: string, constraintId: string) {
  await asUser(uid, (db) => db.query("delete from grouping_constraints where id = $1", [constraintId]));
}

export type StudentDetail = {
  id: string; displayName: string; username: string; avatarColor: string; onboarded: boolean;
  survey: Survey; accommodations: AccommodationKind[]; note: string; classes: { id: string; name: string }[];
};

export async function getStudentDetail(uid: string, studentId: string): Promise<StudentDetail> {
  return asUser(uid, async (db) => {
    const p = await db.maybeOne<{ id: string; display_name: string; username: string; avatar_color: string; onboarded_at: Date | null }>(
      "select id, display_name, username, avatar_color, onboarded_at from profiles where id = $1 and role = 'student'",
      [studentId],
    );
    // Profiles are visible to classmates too, so check the teaching relationship explicitly.
    const teaches = await db.maybeOne("select private.teaches_student($1) as ok", [studentId]) as { ok: boolean } | null;
    if (!p || !teaches?.ok) throw new NotFoundError();
    const prefs = await db.maybeOne<{ survey: Survey }>("select survey from student_preferences where student_id = $1", [studentId]);
    const acc = await db.query<{ kind: AccommodationKind }>("select kind from student_accommodations where student_id = $1 order by kind", [studentId]);
    const note = await db.maybeOne<{ body: string }>("select body from teacher_private_notes where student_id = $1 and teacher_id = $2", [studentId, uid]);
    const classes = await db.query<{ id: string; name: string }>(
      "select c.id, c.name from class_memberships m join classes c on c.id = m.class_id where m.student_id = $1 and c.teacher_id = $2",
      [studentId, uid],
    );
    return {
      id: p.id, displayName: p.display_name, username: p.username, avatarColor: p.avatar_color, onboarded: p.onboarded_at !== null,
      survey: prefs?.survey ?? {}, accommodations: acc.map((a) => a.kind), note: note?.body ?? "", classes,
    };
  });
}

export async function saveAccommodations(uid: string, studentId: string, kinds: AccommodationKind[], note: string) {
  const valid = kinds.filter((k) => ACCOMMODATION_KINDS.includes(k));
  await asUser(uid, async (db) => {
    await db.query("delete from student_accommodations where student_id = $1 and not (kind = any($2))", [studentId, valid]);
    for (const k of valid) {
      await db.query(
        "insert into student_accommodations(student_id, created_by, kind) values ($1,$2,$3) on conflict (student_id, kind) do nothing",
        [studentId, uid, k],
      );
    }
    if (note.trim()) {
      await db.query(
        `insert into teacher_private_notes(student_id, teacher_id, body) values ($1,$2,$3)
         on conflict (student_id, teacher_id) do update set body = excluded.body, updated_at = now()`,
        [studentId, uid, note.trim().slice(0, 4000)],
      );
    } else {
      await db.query("delete from teacher_private_notes where student_id = $1 and teacher_id = $2", [studentId, uid]);
    }
    await db.query(
      "insert into audit_events(actor_id, action, target, details) values ($1, 'accommodations.updated', $2, $3)",
      [uid, studentId, JSON.stringify({ count: valid.length })],
    );
  });
}
