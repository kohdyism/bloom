import "server-only";
import { asServer, asUser, NotFoundError, type Db } from "@/lib/db";
import { config } from "@/lib/config";
import { publish, ch } from "@/lib/realtime/server";
import { ApiError, badRequest, conflict } from "@/lib/api";
import { loadLesson } from "@/lib/modules/lessons";
import { recommendGroups, validateAssignment, pairKey, type GroupingResult, type GroupingStudent } from "@/lib/domain/grouping";
import type { SessionSnapshot } from "@/lib/domain/lesson";
import {
  GROUP_COLORS, GROUP_NAMES, loadGroup, loadSession, makeDisplayToken, makeJoinCode, type GroupRow, type Presentation, type SessionRow,
} from "./common";
import { advanceGroup, notifyGroup, notifyGroupProgress, onEnterStage, facilitate, postSystem } from "./engine";
import { background } from "@/lib/background";

async function audit(db: Db, actorId: string, sessionId: string, action: string, target = "", details: Record<string, unknown> = {}) {
  await db.query("insert into audit_events(actor_id, session_id, action, target, details) values ($1,$2,$3,$4,$5)", [actorId, sessionId, action, target, JSON.stringify(details)]);
}

/** Load a session the caller teaches (RLS-checked) or throw 404. */
async function teacherSession(db: Db, uid: string, sessionId: string): Promise<SessionRow> {
  const s = await loadSession(db, sessionId);
  if (!s || s.teacher_id !== uid) throw new NotFoundError();
  return s;
}

async function teacherGroup(db: Db, uid: string, sessionId: string, groupId: string): Promise<GroupRow> {
  await teacherSession(db, uid, sessionId);
  const g = await loadGroup(db, groupId);
  if (!g || g.session_id !== sessionId) throw new NotFoundError();
  return g;
}

export async function launchSession(uid: string, lessonId: string): Promise<string> {
  return asUser(uid, async (db) => {
    const lesson = await loadLesson(db, uid, lessonId);
    if (!lesson.classId) throw badRequest("Choose a class for this lesson before launching it.");
    if (lesson.needsApproval) throw badRequest("Review and approve the AI-drafted lesson before launching it.");
    if (lesson.isTemplate) throw badRequest("Templates can't be launched. Duplicate it into a lesson first.");
    const snapshot: SessionSnapshot = {
      lessonId: lesson.id,
      title: lesson.title,
      description: lesson.description,
      subject: lesson.subject,
      yearLevel: lesson.yearLevel,
      objectives: lesson.objectives,
      config: lesson.config,
      stages: lesson.stages.map((st) => ({ kind: st.kind, title: st.title, instructions: st.instructions, durationSeconds: st.durationSeconds, config: st.config })),
      materials: lesson.materials.map((m) => ({ id: m.id, title: m.title, kind: m.kind, body: m.kind === "text" ? m.body : "" })),
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      await db.query("savepoint launch");
      try {
        const row = await db.one<{ id: string }>(
          `insert into activity_sessions(lesson_id, class_id, teacher_id, join_code, join_code_expires_at, display_token, snapshot)
           values ($1,$2,$3,$4, now() + make_interval(mins => $5), $6, $7) returning id`,
          [lesson.id, lesson.classId, uid, makeJoinCode(), config.joinCodeTtlMinutes, makeDisplayToken(), JSON.stringify(snapshot)],
        );
        await audit(db, uid, row.id, "session.launched", lessonId);
        return row.id;
      } catch (err) {
        if ((err as { code?: string }).code !== "23505") throw err;
        await db.query("rollback to savepoint launch");
      }
    }
    throw new Error("Couldn't create a unique join code. Please try again.");
  });
}

export async function refreshJoinCode(uid: string, sessionId: string) {
  await asUser(uid, async (db) => {
    const s = await teacherSession(db, uid, sessionId);
    if (s.status === "ended") throw conflict("This lesson has ended.");
    await db.query("update activity_sessions set join_code = $2, join_code_expires_at = now() + make_interval(mins => $3) where id = $1", [sessionId, makeJoinCode(), config.joinCodeTtlMinutes]);
    await audit(db, uid, sessionId, "session.code_refreshed");
  });
  await publish([{ channel: ch.teacher(sessionId), event: "session.updated" }, { channel: ch.display(sessionId), event: "session.updated" }]);
}

/** Run the grouping engine on the students who have joined (or the class, before anyone joins). */
export async function recommendForSession(uid: string, sessionId: string, seed = 1): Promise<GroupingResult & {
  students: { id: string; name: string; avatarColor: string }[]; basedOn: "joined" | "class"; keepApart: [string, string][]; sizeMin: number; sizeMax: number;
}> {
  return asUser(uid, async (db) => {
    const s = await teacherSession(db, uid, sessionId);
    const joined = await db.query<{ student_id: string }>("select student_id from session_participants where session_id = $1", [sessionId]);
    const basedOn = joined.length ? "joined" : "class";
    const students = await db.query<{ id: string; display_name: string; avatar_color: string; survey: Record<string, string> | null }>(
      `select p.id, p.display_name, p.avatar_color, sp.survey
       from class_memberships m join profiles p on p.id = m.student_id
       left join student_preferences sp on sp.student_id = p.id
       where m.class_id = $1 ${basedOn === "joined" ? "and p.id in (select student_id from session_participants where session_id = $2)" : "and $2::uuid is not null"}
       order by p.display_name`,
      [s.class_id, sessionId],
    );
    const supports = await db.query<{ student_id: string; kind: string }>(
      "select student_id, kind from student_accommodations where student_id = any($1)",
      [students.map((x) => x.id)],
    );
    const constraints = await db.query<{ kind: string; student_a: string; student_b: string }>("select kind, student_a, student_b from grouping_constraints where class_id = $1", [s.class_id]);
    // Variety: pairs grouped together in this class's last five sessions.
    const history = await db.query<{ a: string; b: string; n: string }>(
      `select a.student_id as a, b.student_id as b, count(*) as n
       from group_members a join group_members b on a.group_id = b.group_id and a.student_id < b.student_id
       where a.session_id in (select id from activity_sessions where class_id = $1 and id <> $2 order by created_at desc limit 5)
       group by 1, 2`,
      [s.class_id, sessionId],
    );
    const input: GroupingStudent[] = students.map((x) => ({
      id: x.id, name: x.display_name, survey: x.survey ?? {}, supports: supports.filter((a) => a.student_id === x.id).map((a) => a.kind),
    }));
    const result = recommendGroups({
      students: input,
      sizeMin: s.snapshot.config.groupSizeMin,
      sizeMax: s.snapshot.config.groupSizeMax,
      keepApart: constraints.filter((c) => c.kind === "keep_apart").map((c) => [c.student_a, c.student_b]),
      keepTogether: constraints.filter((c) => c.kind === "keep_together").map((c) => [c.student_a, c.student_b]),
      history: Object.fromEntries(history.map((h) => [pairKey(h.a, h.b), Number(h.n)])),
      seed,
    });
    return {
      ...result,
      students: students.map((x) => ({ id: x.id, name: x.display_name, avatarColor: x.avatar_color })),
      basedOn,
      keepApart: constraints.filter((c) => c.kind === "keep_apart").map((c) => [c.student_a, c.student_b] as [string, string]),
      sizeMin: s.snapshot.config.groupSizeMin,
      sizeMax: s.snapshot.config.groupSizeMax,
    };
  });
}

/** Approve (or re-approve, while in the lobby) a group assignment. Hard rules are re-checked server-side. */
export async function approveGroups(uid: string, sessionId: string, groups: string[][]) {
  const created = await asUser(uid, async (db) => {
    const s = await teacherSession(db, uid, sessionId);
    if (s.status !== "lobby") throw conflict("Groups can only be replaced before the lesson starts. Use “Move student” instead.");
    const cleaned = groups.map((g) => [...new Set(g)]).filter((g) => g.length > 0);
    if (!cleaned.length) throw badRequest("Add at least one student to a group.");
    const all = cleaned.flat();
    const enrolled = await db.query<{ student_id: string; name: string }>(
      "select m.student_id, p.display_name as name from class_memberships m join profiles p on p.id = m.student_id where m.class_id = $1 and m.student_id = any($2)",
      [s.class_id, all],
    );
    if (enrolled.length !== new Set(all).size) throw badRequest("Some students in these groups aren't enrolled in this class.");
    const names = (id: string) => enrolled.find((e) => e.student_id === id)?.name ?? "A student";
    const constraints = await db.query<{ student_a: string; student_b: string }>("select student_a, student_b from grouping_constraints where class_id = $1 and kind = 'keep_apart'", [s.class_id]);
    const { blocking } = validateAssignment(cleaned, constraints.map((c) => [c.student_a, c.student_b]), s.snapshot.config.groupSizeMin, s.snapshot.config.groupSizeMax, names);
    if (blocking.length) throw new ApiError(422, "constraint_violation", blocking.join(" "));

    await db.query("delete from session_groups where session_id = $1", [sessionId]);
    for (const [i, g] of cleaned.entries()) {
      const row = await db.one<{ id: string }>(
        "insert into session_groups(session_id, name, color, position) values ($1,$2,$3,$4) returning id",
        [sessionId, GROUP_NAMES[i % GROUP_NAMES.length] + (i >= GROUP_NAMES.length ? ` ${Math.floor(i / GROUP_NAMES.length) + 1}` : ""), GROUP_COLORS[i % GROUP_COLORS.length], i],
      );
      for (const sid of g) {
        await db.query("insert into group_members(session_id, student_id, group_id) values ($1,$2,$3)", [sessionId, sid, row.id]);
      }
    }
    await db.query("update activity_sessions set groups_approved = true where id = $1", [sessionId]);
    await audit(db, uid, sessionId, "groups.approved", "", { groups: cleaned.length, students: all.length });
    return all;
  });
  await publish([
    { channel: ch.session(sessionId), event: "groups.assigned" },
    { channel: ch.teacher(sessionId), event: "groups.assigned" },
    { channel: ch.display(sessionId), event: "groups.assigned" },
    ...created.map((id) => ({ channel: ch.user(id), event: "groups.assigned" })),
  ]);
}

export async function startSession(uid: string, sessionId: string) {
  const groups = await asUser(uid, async (db) => {
    const s = await teacherSession(db, uid, sessionId);
    if (s.status !== "lobby") throw conflict("This lesson has already started.");
    if (!s.groups_approved) throw badRequest("Approve the groups before starting.");
    const first = s.snapshot.stages[0];
    await db.query("update activity_sessions set status = 'active', started_at = now() where id = $1", [sessionId]);
    await db.query(
      `update session_groups set stage_index = 0, stage_status = 'active', stage_started_at = now(),
         stage_deadline = case when $2::int > 0 then now() + make_interval(secs => $2::int) else null end
       where session_id = $1`,
      [sessionId, first?.durationSeconds ?? 0],
    );
    if (first?.kind === "creation") {
      const gs = await db.query<{ id: string }>("select id from session_groups where session_id = $1", [sessionId]);
      for (const g of gs) for (const kind of first.config.artifacts) {
        await db.query("insert into collaborative_artifacts(group_id, kind) values ($1,$2) on conflict do nothing", [g.id, kind]);
      }
    }
    await audit(db, uid, sessionId, "session.started");
    return { session: (await loadSession(db, sessionId))!, groups: await db.query<GroupRow>("select * from session_groups where session_id = $1", [sessionId]) };
  });
  await publish([
    { channel: ch.session(sessionId), event: "session.status" },
    { channel: ch.teacher(sessionId), event: "session.status" },
    { channel: ch.display(sessionId), event: "session.status" },
  ]);
  const stage = groups.session.snapshot.stages[0];
  if (stage) for (const g of groups.groups) await onEnterStage(g, groups.session, stage);
}

export async function setSessionPaused(uid: string, sessionId: string, paused: boolean) {
  await asUser(uid, async (db) => {
    const s = await teacherSession(db, uid, sessionId);
    if (paused && s.status !== "active") throw conflict("Only a running lesson can be paused.");
    if (!paused && s.status !== "paused") throw conflict("The lesson isn't paused.");
    if (paused) {
      await db.query(
        `update session_groups set remaining_seconds_on_pause = greatest(0, extract(epoch from (stage_deadline - now()))::int)
         where session_id = $1 and stage_deadline is not null and not paused`,
        [sessionId],
      );
      await db.query("update activity_sessions set status = 'paused', paused_at = now() where id = $1", [sessionId]);
    } else {
      await db.query(
        `update session_groups set stage_deadline = now() + make_interval(secs => remaining_seconds_on_pause), remaining_seconds_on_pause = null
         where session_id = $1 and remaining_seconds_on_pause is not null and not paused`,
        [sessionId],
      );
      await db.query("update activity_sessions set status = 'active', paused_at = null where id = $1", [sessionId]);
    }
    await audit(db, uid, sessionId, paused ? "session.paused" : "session.resumed");
  });
  await publish([
    { channel: ch.session(sessionId), event: "session.status" },
    { channel: ch.teacher(sessionId), event: "session.status" },
    { channel: ch.display(sessionId), event: "session.status" },
  ]);
}

export async function endSession(uid: string, sessionId: string) {
  await asUser(uid, async (db) => {
    const s = await teacherSession(db, uid, sessionId);
    if (s.status === "ended") return;
    await db.query("update activity_sessions set status = 'ended', ended_at = now(), presentation = null where id = $1", [sessionId]);
    await audit(db, uid, sessionId, "session.ended");
  });
  await publish([
    { channel: ch.session(sessionId), event: "session.status" },
    { channel: ch.teacher(sessionId), event: "session.status" },
    { channel: ch.display(sessionId), event: "session.status" },
  ]);
}

// ---------------------------------------------------------------------------
// Group interventions
// ---------------------------------------------------------------------------
export async function setGroupPaused(uid: string, sessionId: string, groupId: string, paused: boolean) {
  const g = await asUser(uid, async (db) => {
    const g = await teacherGroup(db, uid, sessionId, groupId);
    if (paused && !g.paused) {
      await db.query("update session_groups set paused = true, remaining_seconds_on_pause = case when stage_deadline is null then null else greatest(0, extract(epoch from (stage_deadline - now()))::int) end where id = $1", [groupId]);
    } else if (!paused && g.paused) {
      await db.query("update session_groups set paused = false, stage_deadline = case when remaining_seconds_on_pause is null then stage_deadline else now() + make_interval(secs => remaining_seconds_on_pause) end, remaining_seconds_on_pause = null where id = $1", [groupId]);
    }
    await audit(db, uid, sessionId, paused ? "group.paused" : "group.resumed", groupId);
    return g;
  });
  await notifyGroupProgress(g);
}

export async function extendGroup(uid: string, sessionId: string, groupId: string, seconds: number) {
  const notes: string[] = [];
  if (!Number.isInteger(seconds) || seconds < 30 || seconds > 1800) throw badRequest("Extend by between 30 seconds and 30 minutes.");
  const g = await asUser(uid, async (db) => {
    const g = await teacherGroup(db, uid, sessionId, groupId);
    if (g.paused) {
      await db.query("update session_groups set remaining_seconds_on_pause = coalesce(remaining_seconds_on_pause, 0) + $2 where id = $1", [groupId, seconds]);
    } else {
      await db.query("update session_groups set stage_deadline = greatest(coalesce(stage_deadline, now()), now()) + make_interval(secs => $2) where id = $1", [groupId, seconds]);
    }
    notes.push(`Your teacher added ${Math.round(seconds / 60)} more minute${Math.round(seconds / 60) === 1 ? "" : "s"} to this stage.`);
    await audit(db, uid, sessionId, "group.extended", groupId, { seconds });
    return g;
  });
  await postSystem(groupId, notes);
  await notifyGroupProgress(g);
  await notifyGroup(g, "message.new");
}

export async function teacherAdvanceGroup(uid: string, sessionId: string, groupId: string) {
  const fromIndex = await asUser(uid, async (db) => {
    const g = await teacherGroup(db, uid, sessionId, groupId);
    if (g.stage_status === "complete") throw conflict("This group has finished every stage.");
    const s = await loadSession(db, sessionId);
    if (s?.status === "lobby") throw conflict("Start the lesson first.");
    return g.stage_index;
  });
  await advanceGroup(groupId, { by: "teacher", actorId: uid, fromIndex });
}

/** Restart the current stage (or go back one). Work is never deleted. */
export async function resetGroupStage(uid: string, sessionId: string, groupId: string, mode: "restart" | "back") {
  const notes: string[] = [];
  const result = await asUser(uid, async (db) => {
    const g = await teacherGroup(db, uid, sessionId, groupId);
    const s = (await loadSession(db, sessionId))!;
    const idx = mode === "back" ? Math.max(0, g.stage_index - (g.stage_status === "complete" ? 0 : 1)) : g.stage_index;
    const stage = s.snapshot.stages[idx];
    await db.query(
      `update session_groups set stage_index = $2, stage_status = 'active', stage_started_at = now(),
         stage_deadline = case when $3::int > 0 then now() + make_interval(secs => $3::int) else null end, remaining_seconds_on_pause = null
       where id = $1`,
      [groupId, idx, stage?.durationSeconds ?? 0],
    );
    await db.query("delete from stage_readiness where group_id = $1 and stage_index = $2", [groupId, idx]);
    notes.push(`Your teacher ${mode === "back" ? "moved your group back to" : "restarted"} “${stage?.title}”. Your work so far is kept.`);
    await audit(db, uid, sessionId, "group.stage_reset", groupId, { mode, to: idx });
    return { g: (await loadGroup(db, groupId))!, s, stage };
  });
  await postSystem(groupId, notes);
  await notifyGroupProgress(result.g);
  await notifyGroup(result.g, "message.new");
}

export async function setGroupAi(uid: string, sessionId: string, groupId: string, enabled: boolean) {
  const notes: string[] = [];
  const g = await asUser(uid, async (db) => {
    const g = await teacherGroup(db, uid, sessionId, groupId);
    await db.query("update session_groups set ai_enabled = $2 where id = $1", [groupId, enabled]);
    notes.push(enabled ? "Nova's group prompts are back on." : "Your teacher is facilitating this group directly for now, so Nova's group prompts are paused. Pip, your private helper, still works.");
    await audit(db, uid, sessionId, enabled ? "group.ai_enabled" : "group.ai_disabled", groupId);
    return g;
  });
  await postSystem(groupId, notes);
  await notifyGroupProgress(g);
  await notifyGroup(g, "message.new");
}

export async function teacherGroupMessage(uid: string, sessionId: string, groupId: string, body: string) {
  const g = await asUser(uid, async (db) => {
    const g = await teacherGroup(db, uid, sessionId, groupId);
    await db.query("insert into group_messages(group_id, author_id, kind, body) values ($1,$2,'teacher',$3)", [groupId, uid, body.slice(0, 2000)]);
    return g;
  });
  await notifyGroup(g, "message.new");
}

export async function reassignStudent(uid: string, sessionId: string, studentId: string, toGroupId: string) {
  const moved = await asUser(uid, async (db) => {
    const s = await teacherSession(db, uid, sessionId);
    const to = await loadGroup(db, toGroupId);
    if (!to || to.session_id !== sessionId) throw new NotFoundError();
    const member = await db.maybeOne<{ group_id: string }>("select group_id from group_members where session_id = $1 and student_id = $2", [sessionId, studentId]);
    const enrolled = await db.maybeOne("select 1 from class_memberships where class_id = $1 and student_id = $2", [s.class_id, studentId]);
    if (!enrolled) throw badRequest("That student isn't in this class.");
    const others = await db.query<{ student_id: string }>("select student_id from group_members where group_id = $1 and student_id <> $2", [toGroupId, studentId]);
    const apart = await db.query("select 1 from grouping_constraints where class_id = $1 and kind = 'keep_apart' and ((student_a = $2 and student_b = any($3)) or (student_b = $2 and student_a = any($3)))", [s.class_id, studentId, others.map((o) => o.student_id)]);
    if (apart.length) throw new ApiError(422, "constraint_violation", "That move would break a “keep apart” rule.");
    if (member) await db.query("update group_members set group_id = $3 where session_id = $1 and student_id = $2", [sessionId, studentId, toGroupId]);
    else await db.query("insert into group_members(session_id, student_id, group_id) values ($1,$2,$3)", [sessionId, studentId, toGroupId]);
    await db.query("delete from group_roles where student_id = $1 and group_id = $2", [studentId, member?.group_id ?? toGroupId]);
    await audit(db, uid, sessionId, "student.reassigned", studentId, { from: member?.group_id ?? null, to: toGroupId });
    return { from: member?.group_id ?? null, to };
  });
  const events = [
    { channel: ch.user(studentId), event: "groups.assigned" },
    { channel: ch.teacher(sessionId), event: "groups.assigned" },
    { channel: ch.group(toGroupId), event: "group.members" },
  ];
  if (moved.from) events.push({ channel: ch.group(moved.from), event: "group.members" });
  await publish(events);
}

export async function sendAnnouncement(uid: string, sessionId: string, body: string, groupId: string | null) {
  const text = body.trim().slice(0, 500);
  if (!text) throw badRequest("Write a message first.");
  await asUser(uid, async (db) => {
    const s = await teacherSession(db, uid, sessionId);
    if (groupId) await teacherGroup(db, uid, sessionId, groupId);
    await db.query("insert into announcements(session_id, group_id, body) values ($1,$2,$3)", [s.id, groupId, text]);
    await audit(db, uid, sessionId, "announcement.sent", groupId ?? "class");
  });
  await publish(
    groupId
      ? [{ channel: ch.group(groupId), event: "announcement.new" }]
      : [{ channel: ch.session(sessionId), event: "announcement.new" }, { channel: ch.display(sessionId), event: "announcement.new" }],
  );
}

// ---------------------------------------------------------------------------
// Help requests and private messaging
// ---------------------------------------------------------------------------
export async function updateHelpRequest(uid: string, sessionId: string, helpId: string, status: "seen" | "responding" | "resolved") {
  const studentId = await asUser(uid, async (db) => {
    await teacherSession(db, uid, sessionId);
    const row = await db.maybeOne<{ student_id: string }>("update help_requests set status = $3 where id = $1 and session_id = $2 returning student_id", [helpId, sessionId, status]);
    if (!row) throw new NotFoundError();
    await audit(db, uid, sessionId, `help.${status}`, helpId);
    return row.student_id;
  });
  await publish([{ channel: ch.user(studentId), event: "help.updated" }, { channel: ch.teacher(sessionId), event: "help.updated" }]);
}

export async function sendPrivateMessage(uid: string, sessionId: string, studentId: string, body: string, helpRequestId: string | null) {
  const text = body.trim().slice(0, 2000);
  if (!text) throw badRequest("Write a message first.");
  await asUser(uid, async (db) => {
    const s = await teacherSession(db, uid, sessionId);
    const enrolled = await db.maybeOne("select 1 from class_memberships where class_id = $1 and student_id = $2", [s.class_id, studentId]);
    if (!enrolled) throw new NotFoundError();
    await db.query("insert into teacher_messages(session_id, student_id, sender_id, help_request_id, body) values ($1,$2,$3,$4,$5)", [sessionId, studentId, uid, helpRequestId, text]);
    if (helpRequestId) await db.query("update help_requests set status = 'responding' where id = $1 and session_id = $2 and status in ('sent','seen')", [helpRequestId, sessionId]);
  });
  await publish([{ channel: ch.user(studentId), event: "teacher_message.new" }, { channel: ch.teacher(sessionId), event: "help.updated" }]);
}

// ---------------------------------------------------------------------------
// Submissions and presentation
// ---------------------------------------------------------------------------
export async function reviewSubmission(uid: string, sessionId: string, submissionId: string, status: "reviewed" | "returned", feedback: string) {
  const g = await asUser(uid, async (db) => {
    await teacherSession(db, uid, sessionId);
    const row = await db.maybeOne<{ group_id: string }>(
      `update submissions set status = $2, feedback = $3, reviewed_at = now()
       where id = $1 and group_id in (select id from session_groups where session_id = $4) returning group_id`,
      [submissionId, status, feedback.slice(0, 2000), sessionId],
    );
    if (!row) throw new NotFoundError();
    await audit(db, uid, sessionId, `submission.${status}`, submissionId);
    return (await loadGroup(db, row.group_id))!;
  });
  await notifyGroup(g, "submission.updated");
}

export async function startPresentation(uid: string, sessionId: string, groupId: string, view: Presentation["view"] | null) {
  await asUser(uid, async (db) => {
    const s = await teacherSession(db, uid, sessionId);
    if (s.status === "ended") throw conflict("This lesson has ended.");
    await teacherGroup(db, uid, sessionId, groupId);
    const sub = await db.maybeOne<{ id: string; content: { kinds?: string[] } }>("select id, content from submissions where group_id = $1 order by version desc limit 1", [groupId]);
    if (!sub) throw badRequest("This group hasn't submitted any work to present yet.");
    const kinds = sub.content.kinds ?? [];
    const chosen = view ?? (kinds.includes("slides") ? "slides" : kinds.includes("document") ? "document" : kinds.includes("whiteboard") ? "whiteboard" : "media");
    const p: Presentation = { groupId, submissionId: sub.id, view: chosen, slide: 0, presenterId: null, startedAt: new Date().toISOString() };
    await db.query("update activity_sessions set presentation = $2 where id = $1", [sessionId, JSON.stringify(p)]);
    await db.query("update presentation_requests set status = 'approved' where group_id = $1 and status = 'pending'", [groupId]);
    await audit(db, uid, sessionId, "presentation.started", groupId, { view: chosen });
  });
  await publishPresentation(sessionId);
}

export async function updatePresentation(uid: string, sessionId: string, patch: { slide?: number; view?: Presentation["view"]; presenterId?: string | null }) {
  await asUser(uid, async (db) => {
    const s = await teacherSession(db, uid, sessionId);
    if (!s.presentation) throw conflict("Nothing is being presented.");
    const next = { ...s.presentation };
    if (patch.slide !== undefined) next.slide = Math.max(0, Math.min(200, Math.floor(patch.slide)));
    if (patch.view) next.view = patch.view;
    if (patch.presenterId !== undefined) {
      if (patch.presenterId) {
        const ok = await db.maybeOne("select 1 from group_members where group_id = $1 and student_id = $2", [next.groupId, patch.presenterId]);
        if (!ok) throw badRequest("Only a member of the presenting group can control the slides.");
      }
      next.presenterId = patch.presenterId;
    }
    await db.query("update activity_sessions set presentation = $2 where id = $1", [sessionId, JSON.stringify(next)]);
  });
  await publishPresentation(sessionId);
}

export async function stopPresentation(uid: string, sessionId: string) {
  await asUser(uid, async (db) => {
    await teacherSession(db, uid, sessionId);
    await db.query("update activity_sessions set presentation = null where id = $1", [sessionId]);
    await audit(db, uid, sessionId, "presentation.stopped");
  });
  await publishPresentation(sessionId);
}

export async function declinePresentationRequest(uid: string, sessionId: string, requestId: string) {
  const g = await asUser(uid, async (db) => {
    await teacherSession(db, uid, sessionId);
    const row = await db.maybeOne<{ group_id: string }>("update presentation_requests set status = 'declined' where id = $1 and group_id in (select id from session_groups where session_id = $2) returning group_id", [requestId, sessionId]);
    if (!row) throw new NotFoundError();
    return (await loadGroup(db, row.group_id))!;
  });
  await notifyGroup(g, "presentation.request");
}

export async function publishPresentation(sessionId: string) {
  await publish([
    { channel: ch.session(sessionId), event: "presentation.changed" },
    { channel: ch.teacher(sessionId), event: "presentation.changed" },
    { channel: ch.display(sessionId), event: "presentation.changed" },
  ]);
}

/** Ask the facilitator to post on the teacher's behalf (e.g. "prompt this group"). */
export async function teacherPromptFacilitator(uid: string, sessionId: string, groupId: string) {
  await asUser(uid, (db) => teacherGroup(db, uid, sessionId, groupId));
  background(() => facilitate(groupId, { kind: "ask", quick: "discussion_question" }, `teacher:${Date.now()}`));
}

/** Server-side helper: auto-place a late joiner in the smallest compatible group. */
export async function placeLateJoiner(sessionId: string, studentId: string): Promise<string | null> {
  return asServer(async (db) => {
    const s = await loadSession(db, sessionId);
    if (!s || !s.groups_approved) return null;
    const existing = await db.maybeOne<{ group_id: string }>("select group_id from group_members where session_id = $1 and student_id = $2", [sessionId, studentId]);
    if (existing) return existing.group_id;
    const groups = await db.query<{ id: string; n: string }>(
      "select g.id, (select count(*) from group_members m where m.group_id = g.id) as n from session_groups g where g.session_id = $1 order by 2, g.position",
      [sessionId],
    );
    for (const g of groups) {
      if (Number(g.n) >= s.snapshot.config.groupSizeMax + 1) continue;
      const conflictRow = await db.maybeOne(
        `select 1 from grouping_constraints c join group_members m on m.group_id = $3
         where c.class_id = $1 and c.kind = 'keep_apart' and ((c.student_a = $2 and c.student_b = m.student_id) or (c.student_b = $2 and c.student_a = m.student_id))`,
        [s.class_id, studentId, g.id],
      );
      if (conflictRow) continue;
      await db.query("insert into group_members(session_id, student_id, group_id) values ($1,$2,$3)", [sessionId, studentId, g.id]);
      await db.query("insert into group_messages(group_id, kind, body) values ($1, 'system', 'A classmate has joined your group. Welcome them in!')", [g.id]);
      return g.id;
    }
    return null;
  });
}
