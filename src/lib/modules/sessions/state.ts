import "server-only";
import { isFlowerId } from "@/lib/domain/flowers";
import { asServer, asUser, NotFoundError, type Db } from "@/lib/db";
import { evaluateStage, progressFraction, timerState, type StageEvaluation } from "@/lib/domain/stage-engine";
import type { Stage } from "@/lib/domain/lesson";
import type { SynthesisCluster } from "@/lib/ai/synthesis";
import { collectSignals } from "./engine";
import { loadSession, PRESENCE_WINDOW_SECONDS, type GroupRow, type Presentation, type SessionRow } from "./common";
import { studentContext } from "./student";

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

function timer(session: SessionRow, g: GroupRow) {
  const paused = g.paused || session.status === "paused";
  const remaining = session.status === "paused" && !g.paused && g.stage_deadline
    ? Math.round((new Date(g.stage_deadline).getTime() - new Date(session.paused_at ?? Date.now()).getTime()) / 1000)
    : g.remaining_seconds_on_pause;
  return { ...timerState(g.stage_deadline, paused, remaining, session.snapshot.config.timerWarningSeconds), deadline: iso(g.stage_deadline), paused };
}

export type PublicStage = Pick<Stage, "kind" | "title" | "durationSeconds">;

// ---------------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------------
export async function teacherState(uid: string, sessionId: string) {
  return asUser(uid, async (db) => {
    const s = await loadSession(db, sessionId);
    if (!s || s.teacher_id !== uid) throw new NotFoundError();
    const roster = await db.query<{ id: string; display_name: string; avatar_color: string; joined: boolean; present: boolean; group_id: string | null; acc: string }>(
      `select p.id, p.display_name, p.avatar_color,
              sp.student_id is not null as joined,
              coalesce(sp.last_seen_at > now() - make_interval(secs => $3), false) as present,
              gm.group_id,
              (select count(*) from student_accommodations a where a.student_id = p.id) as acc
       from class_memberships m join profiles p on p.id = m.student_id
       left join session_participants sp on sp.session_id = $1 and sp.student_id = p.id
       left join group_members gm on gm.session_id = $1 and gm.student_id = p.id
       where m.class_id = $2 order by p.display_name`,
      [sessionId, s.class_id, PRESENCE_WINDOW_SECONDS],
    );
    const groupsRaw = await db.query<GroupRow>("select * from session_groups where session_id = $1 order by position", [sessionId]);
    const groups = [];
    for (const g of groupsRaw) {
      const stage = s.snapshot.stages[g.stage_index];
      const signals = await collectSignals(db, g);
      const evaluation = stage && g.stage_status !== "waiting" ? evaluateStage(stage, s.snapshot.config, signals) : null;
      const roles = await db.query<{ student_id: string; role_key: string }>("select student_id, role_key from group_roles where group_id = $1", [g.id]);
      const counts = await db.one<{ ideas: string; shared: string; messages: string; hands: string }>(
        `select (select count(*) from individual_ideas where group_id = $1 and status = 'submitted') as ideas,
                (select count(*) from individual_ideas where group_id = $1 and shared) as shared,
                (select count(*) from group_messages where group_id = $1 and kind = 'student') as messages,
                (select count(*) from hand_raises where group_id = $1) as hands`,
        [g.id],
      );
      const submission = await db.maybeOne<{ id: string; version: number; status: string; created_at: Date }>("select id, version, status, created_at from submissions where group_id = $1 order by version desc limit 1", [g.id]);
      const presReq = await db.maybeOne<{ id: string }>("select id from presentation_requests where group_id = $1 and status = 'pending' limit 1", [g.id]);
      groups.push({
        id: g.id, name: g.name, color: g.color, stageIndex: g.stage_index, stageStatus: g.stage_status, aiEnabled: g.ai_enabled,
        members: roster.filter((r) => r.group_id === g.id).map((r) => r.id),
        roles: roles.reduce<Record<string, string[]>>((acc, r) => { (acc[r.student_id] ??= []).push(r.role_key); return acc; }, {}),
        readiness: signals.ready,
        evaluation,
        timer: timer(s, g),
        progress: progressFraction(g.stage_index, g.stage_status, s.snapshot.stages.length),
        counts: { ideasSubmitted: Number(counts.ideas), ideasShared: Number(counts.shared), messages: Number(counts.messages), handsRaised: Number(counts.hands) },
        submission: submission ? { id: submission.id, version: submission.version, status: submission.status, createdAt: iso(submission.created_at) } : null,
        presentationRequestId: presReq?.id ?? null,
      });
    }
    const help = await db.query<{ id: string; student_id: string; group_id: string | null; reason: string; message: string; priority: string; status: string; created_at: Date }>(
      "select id, student_id, group_id, reason, message, priority, status, created_at from help_requests where session_id = $1 order by (status = 'resolved'), priority desc, created_at desc limit 100",
      [sessionId],
    );
    const threads = await db.query<{ id: string; student_id: string; sender_id: string; help_request_id: string | null; body: string; created_at: Date }>(
      "select id, student_id, sender_id, help_request_id, body, created_at from teacher_messages where session_id = $1 order by created_at",
      [sessionId],
    );
    const aiUsage = await db.query<{ student_id: string; action: string; request_count: string }>("select * from public.private_ai_usage($1)", [sessionId]);
    const reflections = await db.one<{ n: string }>("select count(*) as n from reflection_responses where session_id = $1", [sessionId]);
    const announcements = await db.query<{ id: string; body: string; group_id: string | null; created_at: Date }>("select id, body, group_id, created_at from announcements where session_id = $1 order by created_at desc limit 10", [sessionId]);
    return {
      session: {
        id: s.id, status: s.status, title: s.snapshot.title, objectives: s.snapshot.objectives, groupsApproved: s.groups_approved,
        joinCode: s.join_code, joinCodeExpiresAt: iso(s.join_code_expires_at), displayToken: s.display_token,
        startedAt: iso(s.started_at), pausedAt: iso(s.paused_at), endedAt: iso(s.ended_at),
        stages: s.snapshot.stages.map((x) => ({ kind: x.kind, title: x.title, durationSeconds: x.durationSeconds, completion: x.config.completion })),
        config: { groupSizeMin: s.snapshot.config.groupSizeMin, groupSizeMax: s.snapshot.config.groupSizeMax, roles: s.snapshot.config.roles, facilitationIntensity: s.snapshot.config.facilitationIntensity, presentationRequired: s.snapshot.config.presentationRequired },
        presentation: s.presentation,
        lessonId: s.lesson_id,
      },
      roster: roster.map((r) => ({ id: r.id, name: r.display_name, avatarColor: r.avatar_color, joined: r.joined, present: r.present, groupId: r.group_id, hasSupports: Number(r.acc) > 0 })),
      groups,
      help: help.map((h) => ({ id: h.id, studentId: h.student_id, groupId: h.group_id, reason: h.reason, message: h.message, priority: h.priority, status: h.status, createdAt: iso(h.created_at) })),
      threads: threads.map((t) => ({ id: t.id, studentId: t.student_id, fromTeacher: t.sender_id === uid, helpRequestId: t.help_request_id, body: t.body, createdAt: iso(t.created_at) })),
      aiUsage: aiUsage.map((a) => ({ studentId: a.student_id, action: a.action, count: Number(a.request_count) })),
      reflectionsSubmitted: Number(reflections.n),
      announcements: announcements.map((a) => ({ id: a.id, body: a.body, groupId: a.group_id, createdAt: iso(a.created_at) })),
    };
  });
}
export type TeacherState = Awaited<ReturnType<typeof teacherState>>;

/** Detailed group view for the teacher's drill-down panel. */
export async function teacherGroupDetail(uid: string, sessionId: string, groupId: string) {
  return asUser(uid, async (db) => {
    const s = await loadSession(db, sessionId);
    if (!s || s.teacher_id !== uid) throw new NotFoundError();
    const g = await db.maybeOne<GroupRow>("select * from session_groups where id = $1 and session_id = $2", [groupId, sessionId]);
    if (!g) throw new NotFoundError();
    return groupContent(db, s, g, uid, "teacher");
  });
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------
export async function studentState(uid: string, sessionId: string) {
  return asUser(uid, async (db) => {
    const { session: s, group: g } = await studentContext(db, uid, sessionId);
    await db.query("update session_participants set last_seen_at = now() where session_id = $1 and student_id = $2", [sessionId, uid]);
    const me = await db.one<{ display_name: string; avatar_color: string }>("select display_name, avatar_color from profiles where id = $1", [uid]);
    const announcements = await db.query<{ id: string; body: string; group_id: string | null; created_at: Date }>(
      "select id, body, group_id, created_at from announcements where session_id = $1 order by created_at desc limit 5",
      [sessionId],
    );
    const help = await db.query<{ id: string; reason: string; message: string; status: string; created_at: Date }>(
      "select id, reason, message, status, created_at from help_requests where session_id = $1 and student_id = $2 order by created_at desc",
      [sessionId, uid],
    );
    const thread = await db.query<{ id: string; sender_id: string; body: string; created_at: Date }>(
      "select id, sender_id, body, created_at from teacher_messages where session_id = $1 and student_id = $2 order by created_at",
      [sessionId, uid],
    );
    const reflection = await db.maybeOne("select 1 from reflection_responses where session_id = $1 and student_id = $2", [sessionId, uid]);
    const groupCount = await db.one<{ n: string }>("select count(*) as n from session_participants where session_id = $1", [sessionId]);
    return {
      me: { id: uid, name: me.display_name, avatarColor: me.avatar_color },
      session: {
        id: s.id, status: s.status, title: s.snapshot.title, description: s.snapshot.description, objectives: s.snapshot.objectives,
        subject: s.snapshot.subject, groupsApproved: s.groups_approved, joinedCount: Number(groupCount.n),
        stages: s.snapshot.stages.map((x) => ({ kind: x.kind, title: x.title, durationSeconds: x.durationSeconds })),
        materials: s.snapshot.materials,
        roles: s.snapshot.config.roles,
        rolesOptional: s.snapshot.config.rolesOptional,
        theme: s.snapshot.config.gamificationTheme,
        modality: s.snapshot.config.modality,
        anonymity: s.snapshot.config.ideaAnonymity,
        allowResubmission: s.snapshot.config.allowResubmission,
        presentation: s.presentation,
      },
      announcements: announcements.map((a) => ({ id: a.id, body: a.body, toGroup: !!a.group_id, createdAt: iso(a.created_at) })),
      group: g ? await groupContent(db, s, g, uid, "student") : null,
      help: help.map((h) => ({ id: h.id, reason: h.reason, message: h.message, status: h.status, createdAt: iso(h.created_at) })),
      thread: thread.map((t) => ({ id: t.id, fromMe: t.sender_id === uid, body: t.body, createdAt: iso(t.created_at) })),
      reflectionDone: !!reflection,
    };
  });
}
export type StudentState = Awaited<ReturnType<typeof studentState>>;

/**
 * Everything about one group that its members (or the teacher) may see.
 * Anonymous-idea mode strips authorship from other people's ideas before the
 * data leaves the server.
 */
async function groupContent(db: Db, s: SessionRow, g: GroupRow, viewerId: string, viewer: "student" | "teacher") {
  const stage = s.snapshot.stages[g.stage_index] ?? null;
  const members = await db.query<{ id: string; display_name: string; avatar_color: string; present: boolean }>(
    `select p.id, p.display_name, p.avatar_color, coalesce(sp.last_seen_at > now() - make_interval(secs => $2), false) as present
     from group_members gm join profiles p on p.id = gm.student_id
     left join session_participants sp on sp.session_id = gm.session_id and sp.student_id = gm.student_id
     where gm.group_id = $1 order by p.display_name`,
    [g.id, PRESENCE_WINDOW_SECONDS],
  );
  const roles = await db.query<{ student_id: string; role_key: string }>("select student_id, role_key from group_roles where group_id = $1", [g.id]);
  const hands = await db.query<{ student_id: string }>("select student_id from hand_raises where group_id = $1 order by raised_at", [g.id]);
  const signals = await collectSignals(db, g);
  const evaluation: StageEvaluation | null = stage && g.stage_status !== "waiting" ? evaluateStage(stage, s.snapshot.config, signals) : null;
  const anonymous = s.snapshot.config.ideaAnonymity === "anonymous" && viewer === "student";
  const ideas = await db.query<{ id: string; author_id: string; body: string; status: string; shared: boolean; builds_on: string | null; stage_index: number; created_at: Date }>(
    "select id, author_id, body, status, shared, builds_on, stage_index, created_at from individual_ideas where group_id = $1 order by created_at",
    [g.id],
  );
  const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? "Former member";
  const synthesis = await db.maybeOne<{ version: number; origin: string; clusters: SynthesisCluster[]; note: string; created_by: string | null; created_at: Date }>(
    "select version, origin, clusters, note, created_by, created_at from idea_syntheses where group_id = $1 order by version desc limit 1",
    [g.id],
  );
  const firstSynthesis = await db.maybeOne<{ origin: string }>("select origin from idea_syntheses where group_id = $1 and origin <> 'student_edit' order by version desc limit 1", [g.id]);
  const messages = await db.query<{ id: string; author_id: string | null; kind: string; ai_origin: string | null; body: string; reply_to: string | null; pinned: boolean; created_at: Date }>(
    "select * from (select id, author_id, kind, ai_origin, body, reply_to, pinned, created_at from group_messages where group_id = $1 order by created_at desc limit 200) m order by created_at",
    [g.id],
  );
  const reactions = await db.query<{ message_id: string; user_id: string; kind: string }>(
    "select r.message_id, r.user_id, r.kind from message_reactions r join group_messages m on m.id = r.message_id where m.group_id = $1",
    [g.id],
  );
  const votes = await db.query<{ voter_id: string; target_id: string }>("select voter_id, target_id from votes where group_id = $1 and stage_index = $2", [g.id, g.stage_index]);
  const checkins = await db.query<{ item_index: number }>("select item_index from group_checkins where group_id = $1 and stage_index = $2", [g.id, g.stage_index]);
  const artifacts = await db.query<{ id: string; kind: string }>("select id, kind from collaborative_artifacts where group_id = $1", [g.id]);
  const media = await db.query<{ id: string; uploader_id: string; caption: string; mime_type: string; created_at: Date }>("select id, uploader_id, caption, mime_type, created_at from media_uploads where group_id = $1 order by created_at", [g.id]);
  const submissions = await db.query<{ id: string; version: number; status: string; submitted_by: string; feedback: string; note: string; created_at: Date; reviewed_at: Date | null; content: { kinds?: string[] } }>(
    "select id, version, status, submitted_by, feedback, note, created_at, reviewed_at, content from submissions where group_id = $1 order by version desc",
    [g.id],
  );
  const presReq = await db.maybeOne<{ status: string }>("select status from presentation_requests where group_id = $1 order by created_at desc limit 1", [g.id]);
  const announcements = await db.query<{ id: string; body: string; created_at: Date }>("select id, body, created_at from announcements where group_id = $1 order by created_at desc limit 5", [g.id]);

  return {
    id: g.id, name: g.name, color: g.color,
    stageIndex: g.stage_index, stageStatus: g.stage_status, stage, nextStage: s.snapshot.stages[g.stage_index + 1] ?? null,
    timer: timer(s, g), aiEnabled: g.ai_enabled, milestones: g.milestones,
    flower: isFlowerId(g.flower) ? g.flower : null,
    stageStartedAt: iso(g.stage_started_at),
    progress: progressFraction(g.stage_index, g.stage_status, s.snapshot.stages.length),
    evaluation,
    myReadiness: signals.ready[viewerId] ?? null,
    readyIds: Object.entries(signals.ready).filter(([, v]) => v === "ready").map(([k]) => k),
    members: members.map((m) => ({ id: m.id, name: m.display_name, avatarColor: m.avatar_color, present: m.present, roles: roles.filter((r) => r.student_id === m.id).map((r) => r.role_key), handRaised: hands.some((h) => h.student_id === m.id) })),
    ideas: {
      mine: ideas.filter((i) => i.author_id === viewerId).map((i) => ({ id: i.id, body: i.body, status: i.status, shared: i.shared, createdAt: iso(i.created_at) })),
      // Other people's ideas are only visible once shared (RLS enforces this too).
      shared: ideas.filter((i) => i.shared && i.status === "submitted").map((i) => ({
        id: i.id, body: i.body, buildsOn: i.builds_on, mine: i.author_id === viewerId,
        author: i.author_id === viewerId ? "You" : anonymous ? "A groupmate" : name(i.author_id),
        authorId: anonymous && i.author_id !== viewerId ? null : i.author_id,
      })),
      ...(viewer === "teacher" ? { privateDraftCount: ideas.filter((i) => !i.shared).length } : {}),
    },
    synthesis: synthesis ? { version: synthesis.version, origin: synthesis.origin, aiOrigin: firstSynthesis?.origin ?? null, clusters: synthesis.clusters, note: synthesis.note, editedBy: synthesis.created_by ? name(synthesis.created_by) : null, createdAt: iso(synthesis.created_at) } : null,
    messages: messages.map((m) => ({
      id: m.id, kind: m.kind, aiOrigin: m.ai_origin, body: m.body, replyTo: m.reply_to, pinned: m.pinned, createdAt: iso(m.created_at),
      authorId: m.author_id, author: m.kind === "teacher" ? "Teacher" : m.kind === "ai" ? "Bloom" : m.kind === "system" ? "Canopy" : name(m.author_id ?? ""),
      reactions: Object.entries(reactions.filter((r) => r.message_id === m.id).reduce<Record<string, string[]>>((acc, r) => { (acc[r.kind] ??= []).push(r.user_id); return acc; }, {})).map(([kind, users]) => ({ kind, count: users.length, mine: users.includes(viewerId) })),
    })),
    votes: {
      mine: votes.filter((v) => v.voter_id === viewerId).map((v) => v.target_id),
      tally: votes.reduce<Record<string, number>>((acc, v) => { acc[v.target_id] = (acc[v.target_id] ?? 0) + 1; return acc; }, {}),
      perStudent: stage?.kind === "voting" ? stage.config.votesPerStudent : 0,
    },
    checkins: checkins.map((c) => c.item_index),
    artifacts: artifacts.map((a) => ({ id: a.id, kind: a.kind })),
    media: media.map((m) => ({ id: m.id, caption: m.caption, mimeType: m.mime_type, mine: m.uploader_id === viewerId, createdAt: iso(m.created_at) })),
    submissions: submissions.map((x) => ({ id: x.id, version: x.version, status: x.status, submittedBy: name(x.submitted_by), feedback: x.feedback, note: x.note, kinds: x.content.kinds ?? [], createdAt: iso(x.created_at), reviewedAt: iso(x.reviewed_at) })),
    presentationRequest: presReq?.status ?? null,
    announcements: announcements.map((a) => ({ id: a.id, body: a.body, createdAt: iso(a.created_at) })),
  };
}
export type GroupContent = Awaited<ReturnType<typeof groupContent>>;

// ---------------------------------------------------------------------------
// Public classroom display — built from an explicit allow-list
// ---------------------------------------------------------------------------
/**
 * The classroom screen can move the slides of whatever is being presented
 * (a clicker or the arrow keys on the classroom computer). Nothing else.
 */
export async function displaySetSlide(token: string, slide: number) {
  const id = await asServer(async (db) => {
    const row = await db.maybeOne<{ id: string }>(
      `update activity_sessions set presentation = jsonb_set(presentation, '{slide}', to_jsonb($2::int))
       where display_token = $1 and presentation is not null and status <> 'ended' returning id`,
      [token, Math.max(0, Math.min(200, Math.floor(slide)))],
    );
    return row?.id ?? null;
  });
  if (!id) throw new NotFoundError();
  return id;
}

export async function displayState(token: string) {
  return asServer(async (db) => {
    const row = await db.maybeOne<{ id: string }>("select id from activity_sessions where display_token = $1", [token]);
    if (!row) throw new NotFoundError();
    const s = (await loadSession(db, row.id))!;
    const groups = await db.query<GroupRow & { member_count: string }>(
      "select g.*, (select count(*) from group_members m where m.group_id = g.id) as member_count from session_groups g where g.session_id = $1 order by position",
      [s.id],
    );
    const joined = await db.query<{ display_name: string; avatar_color: string }>(
      "select p.display_name, p.avatar_color from session_participants sp join profiles p on p.id = sp.student_id where sp.session_id = $1 order by sp.joined_at",
      [s.id],
    );
    const announcement = await db.maybeOne<{ body: string; created_at: Date }>("select body, created_at from announcements where session_id = $1 and group_id is null order by created_at desc limit 1", [s.id]);
    return {
      // Allow-listed fields only. No accommodations, notes, help requests,
      // private AI, reflections or individual contributions ever appear here.
      title: s.snapshot.title,
      objectives: s.snapshot.objectives,
      status: s.status,
      joinCode: s.status === "lobby" || s.status === "active" ? s.join_code : null,
      joinCodeExpiresAt: iso(s.join_code_expires_at),
      joined: joined.map((j) => ({ name: firstNameInitial(j.display_name), avatarColor: j.avatar_color })),
      stages: s.snapshot.stages.map((x) => ({ kind: x.kind, title: x.title, durationSeconds: x.durationSeconds })),
      theme: s.snapshot.config.gamificationTheme,
      groups: groups.map((g) => ({
        id: g.id, name: g.name, color: g.color, memberCount: Number(g.member_count), stageIndex: g.stage_index, stageStatus: g.stage_status,
        progress: progressFraction(g.stage_index, g.stage_status, s.snapshot.stages.length), timer: timer(s, g),
      })),
      announcement: announcement ? { body: announcement.body, createdAt: iso(announcement.created_at) } : null,
      presentation: s.presentation ? await presentationContent(db, s, s.presentation) : null,
    };
  });
}
export type DisplayState = Awaited<ReturnType<typeof displayState>>;

function firstNameInitial(name: string) {
  const [first, ...rest] = name.split(" ");
  return rest.length ? `${first} ${rest[rest.length - 1][0]}` : first;
}

/** The presented submission snapshot — read-only for everyone in the session. */
export async function presentationContent(db: Db, s: SessionRow, p: Presentation) {
  const sub = await db.maybeOne<{ id: string; content: Record<string, unknown>; version: number }>("select id, content, version from submissions where id = $1", [p.submissionId]);
  const group = await db.maybeOne<{ name: string; color: string }>("select name, color from session_groups where id = $1 and session_id = $2", [p.groupId, s.id]);
  if (!sub || !group) return null;
  const members = await db.query<{ display_name: string }>("select p.display_name from group_members gm join profiles p on p.id = gm.student_id where gm.group_id = $1 order by p.display_name", [p.groupId]);
  return {
    groupId: p.groupId, groupName: group.name, groupColor: group.color, members: members.map((m) => firstNameInitial(m.display_name)),
    view: p.view, slide: p.slide, presenterId: p.presenterId, submissionId: sub.id, version: sub.version, content: sub.content,
  };
}

/** Presentation for a participant's device: same read-only snapshot. */
export async function studentPresentation(uid: string, sessionId: string) {
  const s = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    return ctx.session;
  });
  if (!s.presentation) return null;
  return asServer((db) => presentationContent(db, s, s.presentation!));
}

/** The student's own group's latest submitted snapshot (read-only), for looking back at it. */
export async function studentOwnSubmission(uid: string, sessionId: string) {
  const groupId = await asUser(uid, async (db) => (await studentContext(db, uid, sessionId)).group?.id ?? null);
  if (!groupId) return null;
  return asServer((db) => db.maybeOne<{ id: string; version: number; content: Record<string, unknown>; note: string }>(
    "select id, version, content, note from submissions where group_id = $1 order by version desc limit 1",
    [groupId],
  ));
}

/**
 * A submitted piece of work for export (print / save as PDF). Only the
 * lesson's teacher or a member of the group that made it can open it.
 */
export async function submissionForExport(uid: string, submissionId: string) {
  return asServer(async (db) => {
    const row = await db.maybeOne<{ content: Record<string, unknown>; version: number; created_at: Date; group_name: string; group_id: string; title: string; teacher_id: string; session_id: string }>(
      `select sub.content, sub.version, sub.created_at, g.name as group_name, g.id as group_id, s.snapshot ->> 'title' as title, s.teacher_id, s.id as session_id
       from submissions sub join session_groups g on g.id = sub.group_id join activity_sessions s on s.id = g.session_id where sub.id = $1`,
      [submissionId],
    );
    if (!row) throw new NotFoundError();
    const member = await db.maybeOne("select 1 from group_members where group_id = $1 and student_id = $2", [row.group_id, uid]);
    if (row.teacher_id !== uid && !member) throw new NotFoundError();
    const members = await db.query<{ display_name: string }>("select p.display_name from group_members m join profiles p on p.id = m.student_id where m.group_id = $1 order by p.display_name", [row.group_id]);
    return { content: row.content, version: row.version, submittedAt: iso(row.created_at), groupName: row.group_name, title: row.title, members: members.map((m) => m.display_name) };
  });
}
