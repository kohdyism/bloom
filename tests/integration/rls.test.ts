import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));
vi.mock("next/server", () => ({ after: () => { throw new Error("outside request"); }, NextResponse: { json: (b: unknown) => b } }));

import { migrate, reset } from "../../scripts/db";
import { seed } from "../../scripts/seed";
import { asServer, asUser, pool } from "@/lib/db";
import { launchSession, approveGroups, startSession, sendPrivateMessage } from "@/lib/modules/sessions/teacher";
import { joinWithCode, saveIdea, postMessage, createHelpRequest } from "@/lib/modules/sessions/student";
import { askPrivateAssistant } from "@/lib/modules/private-ai";
import { displayState, studentState, teacherState } from "@/lib/modules/sessions/state";

/**
 * Integration tests against a real Postgres with the production migrations
 * and RLS policies. Every check here goes through `asUser`, i.e. the same
 * `role authenticated` + JWT-claims path the app uses.
 */
const ids: Record<string, string> = {};
let sessionId = "";
let groups: string[][] = [];

beforeAll(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await reset(client);
  await migrate(client);
  await seed(client);
  const rows = await client.query<{ id: string; username: string }>("select id, username from profiles");
  for (const r of rows.rows) ids[r.username] = r.id;
  await client.end();

  // A lesson session in the Literature class with two groups of two.
  const lesson = await asServer((db) => db.one<{ id: string }>("select id from lessons where title like 'Reading%'"));
  await asServer((db) => db.query("update lessons set config = jsonb_set(jsonb_set(config, '{groupSizeMin}', '2'), '{groupSizeMax}', '2') where id = $1", [lesson.id]));
  sessionId = await launchSession(ids["teacher.demo"], lesson.id);
  const code = (await asServer((db) => db.one<{ join_code: string }>("select join_code from activity_sessions where id = $1", [sessionId]))).join_code;
  for (const u of ["ben.o", "dev.p", "grace.l", "hamza.a"]) await joinWithCode(ids[u], code);
  groups = [[ids["ben.o"], ids["dev.p"]], [ids["grace.l"], ids["hamza.a"]]];
  await approveGroups(ids["teacher.demo"], sessionId, groups);
  await startSession(ids["teacher.demo"], sessionId);
});

afterAll(async () => {
  await pool().end();
  globalThis.__bloomPool = undefined;
});

const groupIdOf = async (u: string) => (await asServer((db) => db.one<{ group_id: string }>("select group_id from group_members where session_id = $1 and student_id = $2", [sessionId, ids[u]]))).group_id;

describe("joining", () => {
  it("a code alone is not enough: students from another class can't join", async () => {
    const code = (await asServer((db) => db.one<{ join_code: string }>("select join_code from activity_sessions where id = $1", [sessionId]))).join_code;
    // Seed: the Literature class has all 20 students, so create an outsider student.
    const outsider = await asServer(async (db) => {
      const u = await db.one<{ id: string }>("insert into auth.users(email) values ('outsider@students.bloom.demo') returning id");
      await db.query("insert into profiles(id, role, display_name, username) values ($1, 'student', 'Outsider', 'outsider.x')", [u.id]);
      return u.id;
    });
    await expect(joinWithCode(outsider, code)).rejects.toMatchObject({ code: "not_enrolled" });
  });
  it("expired codes are refused for new joiners", async () => {
    await asServer((db) => db.query("update activity_sessions set join_code_expires_at = now() - interval '1 minute' where id = $1", [sessionId]));
    const code = (await asServer((db) => db.one<{ join_code: string }>("select join_code from activity_sessions where id = $1", [sessionId]))).join_code;
    await expect(joinWithCode(ids["isla.w"], code)).rejects.toMatchObject({ code: "code_expired" });
    // Students who already joined can still re-enter (e.g. after changing devices).
    await expect(joinWithCode(ids["ben.o"], code)).resolves.toBe(sessionId);
    await asServer((db) => db.query("update activity_sessions set join_code_expires_at = now() + interval '1 hour' where id = $1", [sessionId]));
  });
});

describe("row-level security", () => {
  it("students see only their own functional supports and never teacher notes", async () => {
    const r = await asUser(ids["ben.o"], async (db) => ({
      acc: await db.query<{ student_id: string }>("select student_id from student_accommodations"),
      notes: await db.query("select * from teacher_private_notes"),
    }));
    expect(r.acc.length).toBeGreaterThan(0);
    expect(r.acc.every((a) => a.student_id === ids["ben.o"])).toBe(true);
    expect(r.notes).toHaveLength(0);
  });

  it("ideas stay private to their author until shared", async () => {
    await saveIdea(ids["ben.o"], sessionId, { body: "A private first thought", submit: true });
    const seenByPartner = await asUser(ids["dev.p"], (db) => db.query("select * from individual_ideas where body = 'A private first thought'"));
    expect(seenByPartner).toHaveLength(0);
    const seenByTeacher = await asUser(ids["teacher.demo"], (db) => db.query("select * from individual_ideas where body = 'A private first thought'"));
    expect(seenByTeacher).toHaveLength(1);
  });

  it("students cannot read another group's messages", async () => {
    await postMessage(ids["ben.o"], sessionId, "Group one only", null);
    const other = await asUser(ids["grace.l"], (db) => db.query("select * from group_messages where body = 'Group one only'"));
    expect(other).toHaveLength(0);
    const partner = await asUser(ids["dev.p"], (db) => db.query("select * from group_messages where body = 'Group one only'"));
    expect(partner).toHaveLength(1);
  });

  it("students cannot author AI, system or teacher messages, or post into another group", async () => {
    const g1 = await groupIdOf("ben.o");
    const g2 = await groupIdOf("grace.l");
    for (const kind of ["ai", "system"]) {
      await expect(asUser(ids["ben.o"], (db) => db.query("insert into group_messages(group_id, kind, body) values ($1, $2, 'spoof')", [g1, kind]))).rejects.toMatchObject({ code: "42501" });
    }
    await expect(asUser(ids["ben.o"], (db) => db.query("insert into group_messages(group_id, author_id, kind, body) values ($1, $2, 'teacher', 'spoof')", [g1, ids["ben.o"]]))).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(ids["ben.o"], (db) => db.query("insert into group_messages(group_id, author_id, kind, body) values ($1, $2, 'student', 'intrude')", [g2, ids["ben.o"]]))).rejects.toMatchObject({ code: "42501" });
  });

  it("private assistant transcripts are visible only to their student — not groupmates, not the teacher", async () => {
    await askPrivateAssistant(ids["ben.o"], sessionId, "question", "What does 'common spring' mean?");
    const partner = await asUser(ids["dev.p"], (db) => db.query("select * from private_ai_messages where student_id = $1", [ids["ben.o"]]));
    const teacher = await asUser(ids["teacher.demo"], (db) => db.query("select * from private_ai_messages"));
    const own = await asUser(ids["ben.o"], (db) => db.query("select * from private_ai_messages"));
    expect(partner).toHaveLength(0);
    expect(teacher).toHaveLength(0);
    expect(own.length).toBeGreaterThanOrEqual(2);
    // The teacher sees aggregate metadata only.
    const usage = await asUser(ids["teacher.demo"], (db) => db.query<{ student_id: string; action: string; request_count: string }>("select * from public.private_ai_usage($1)", [sessionId]));
    expect(usage).toEqual([{ student_id: ids["ben.o"], action: "question", request_count: "1" }]);
    expect(JSON.stringify(usage)).not.toContain("common spring");
    // And a student can't call the metadata function for someone else's view.
    const studentUsage = await asUser(ids["dev.p"], (db) => db.query("select * from public.private_ai_usage($1)", [sessionId]));
    expect(studentUsage).toHaveLength(0);
  });

  it("help requests and teacher messages are invisible to other students", async () => {
    const helpId = await createHelpRequest(ids["dev.p"], sessionId, "uncomfortable", "Something in my group");
    await sendPrivateMessage(ids["teacher.demo"], sessionId, ids["dev.p"], "Coming over now", helpId);
    const partner = await asUser(ids["ben.o"], async (db) => ({
      help: await db.query("select * from help_requests where student_id = $1", [ids["dev.p"]]),
      msgs: await db.query("select * from teacher_messages where student_id = $1", [ids["dev.p"]]),
    }));
    expect(partner.help).toHaveLength(0);
    expect(partner.msgs).toHaveLength(0);
    const own = await studentState(ids["dev.p"], sessionId);
    expect(own.help[0]).toMatchObject({ reason: "uncomfortable", status: "responding" });
    const teacher = await teacherState(ids["teacher.demo"], sessionId);
    expect(teacher.help.find((h) => h.id === helpId)?.priority).toBe("urgent");
  });

  it("the realtime event log is server-only", async () => {
    await expect(asUser(ids["ben.o"], (db) => db.query("select * from realtime_events"))).rejects.toMatchObject({ code: "42501" });
  });

  it("students cannot change their own role or another student's profile", async () => {
    await expect(asUser(ids["ben.o"], (db) => db.query("update profiles set role = 'teacher' where id = $1", [ids["ben.o"]]))).rejects.toMatchObject({ code: "42501" });
    const touched = await asUser(ids["ben.o"], (db) => db.query("update profiles set display_name = 'Hacked' where id = $1 returning id", [ids["dev.p"]]));
    expect(touched).toHaveLength(0);
  });

  it("a teacher can't read another teacher's classes or students' support data", async () => {
    const other = await asServer(async (db) => {
      const u = await db.one<{ id: string }>("insert into auth.users(email) values ('other.teacher@staff.bloom.demo') returning id");
      await db.query("insert into profiles(id, role, display_name, username) values ($1, 'teacher', 'Mr Other', 'other.teacher')", [u.id]);
      return u.id;
    });
    const seen = await asUser(other, async (db) => ({
      classes: await db.query("select * from classes"),
      acc: await db.query("select * from student_accommodations"),
      prefs: await db.query("select * from student_preferences"),
      sessions: await db.query("select * from activity_sessions"),
    }));
    expect(seen.classes).toHaveLength(0);
    expect(seen.acc).toHaveLength(0);
    expect(seen.prefs).toHaveLength(0);
    expect(seen.sessions).toHaveLength(0);
    await expect(teacherState(other, sessionId)).rejects.toThrow();
  });
});

describe("grouping approval", () => {
  it("re-checks keep-apart rules on the server, whatever the client sends", async () => {
    const lesson = await asServer((db) => db.one<{ id: string }>("select id from lessons where title like 'Reading%'"));
    const sid = await launchSession(ids["teacher.demo"], lesson.id);
    // chloe.m and felix.t have a keep-apart rule in the seed data.
    await expect(approveGroups(ids["teacher.demo"], sid, [[ids["chloe.m"], ids["felix.t"]]])).rejects.toMatchObject({ code: "constraint_violation" });
  });
});

describe("public display projection", () => {
  it("contains no protected information", async () => {
    const token = (await asServer((db) => db.one<{ display_token: string }>("select display_token from activity_sessions where id = $1", [sessionId]))).display_token;
    const d = JSON.stringify(await displayState(token));
    for (const secret of ["Something in my group", "Coming over now", "common spring", "A private first thought", "Group one only", "extra_processing_time", "Fictional demo note", "uncomfortable"]) {
      expect(d).not.toContain(secret);
    }
  });
});
