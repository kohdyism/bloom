import "server-only";
import { asServer, asUser, NotFoundError, type Db } from "@/lib/db";
import { publish, ch } from "@/lib/realtime/server";
import { ApiError, badRequest, conflict, forbidden } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";
import { mentionsHelper } from "@/lib/domain/mentions";
import { background } from "@/lib/background";
import { loadGroup, loadSession, type GroupRow, type SessionRow } from "./common";
import { checkParticipationBalance, facilitate, notifyGroup, runSynthesis, syncGroup } from "./engine";
import { placeLateJoiner, publishPresentation } from "./teacher";
import type { FacilitatorTrigger } from "@/lib/ai/facilitator";
import type { SynthesisCluster } from "@/lib/ai/synthesis";

export type StudentCtx = { session: SessionRow; group: GroupRow | null };

/** Resolve the caller's own session participation and group (RLS-checked). */
export async function studentContext(db: Db, uid: string, sessionId: string): Promise<StudentCtx> {
  const participant = await db.maybeOne("select 1 from session_participants where session_id = $1 and student_id = $2", [sessionId, uid]);
  if (!participant) throw new NotFoundError();
  const session = await loadSession(db, sessionId);
  if (!session) throw new NotFoundError();
  const m = await db.maybeOne<{ group_id: string }>("select group_id from group_members where session_id = $1 and student_id = $2", [sessionId, uid]);
  const group = m ? await loadGroup(db, m.group_id) : null;
  return { session, group };
}

function requireGroup(ctx: StudentCtx): GroupRow {
  if (!ctx.group) throw conflict("You haven't been placed in a group yet.");
  return ctx.group;
}

function requireActive(ctx: StudentCtx) {
  if (ctx.session.status === "lobby") throw conflict("Your teacher hasn't started the lesson yet.");
  if (ctx.session.status === "paused") throw conflict("Your teacher has paused the lesson. Your work is saved.");
  if (ctx.session.status === "ended") throw conflict("This lesson has ended. Your work is saved.");
  if (ctx.group?.paused) throw conflict("Your group is paused by your teacher for a moment. Your work is saved.");
}

const stageKind = (ctx: StudentCtx) => (ctx.group ? ctx.session.snapshot.stages[ctx.group.stage_index]?.kind : undefined);

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------
export async function joinWithCode(uid: string, code: string): Promise<string> {
  await rateLimit(`join:${uid}`, 12, 300);
  const normalised = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (normalised.length < 4) throw badRequest("Enter the code shown on your teacher's screen.", "invalid_code");
  let sessionId: string;
  try {
    sessionId = await asUser(uid, (db) => db.one<{ id: string }>("select public.join_session_by_code($1) as id", [normalised]).then((r) => r.id));
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (msg.includes("code_not_found")) throw new ApiError(404, "code_not_found", "We couldn't find a lesson with that code. Check the code on the board — it may have changed.");
    if (msg.includes("code_expired")) throw new ApiError(410, "code_expired", "That code has expired. Ask your teacher for a new one.");
    if (msg.includes("not_enrolled")) throw new ApiError(403, "not_enrolled", "That lesson is for a class you're not in. Check with your teacher.");
    throw err;
  }
  const lateGroup = await placeLateJoiner(sessionId, uid);
  await publish([
    { channel: ch.teacher(sessionId), event: "participant.joined", payload: { studentId: uid } },
    { channel: ch.session(sessionId), event: "participant.joined" },
    { channel: ch.display(sessionId), event: "participant.joined" },
    ...(lateGroup ? [{ channel: ch.group(lateGroup), event: "group.members" }] : []),
  ]);
  return sessionId;
}

// ---------------------------------------------------------------------------
// Roles and readiness
// ---------------------------------------------------------------------------
export async function setRoles(uid: string, sessionId: string, roleKeys: string[]) {
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    requireActive(ctx);
    if (stageKind(ctx) !== "role_selection") throw conflict("Roles are chosen during the role selection stage. Ask your teacher if you need to change.");
    const allowed = new Set(ctx.session.snapshot.config.roles.map((r) => r.key));
    const keys = [...new Set(roleKeys)].filter((k) => allowed.has(k)).slice(0, 4);
    await db.query("delete from group_roles where group_id = $1 and student_id = $2", [group.id, uid]);
    for (const k of keys) await db.query("insert into group_roles(group_id, student_id, role_key) values ($1,$2,$3)", [group.id, uid, k]);
    return group;
  });
  await notifyGroup(group, "group.roles");
  await syncGroup(group.id);
}

export async function setReadiness(uid: string, sessionId: string, state: "ready" | "need_time" | null) {
  const { group, announceNeedTime } = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    requireActive(ctx);
    if (group.stage_status === "complete") throw conflict("Your group has finished every stage.");
    const prev = await db.maybeOne<{ state: string }>("select state from stage_readiness where group_id = $1 and stage_index = $2 and student_id = $3", [group.id, group.stage_index, uid]);
    if (state === null) await db.query("delete from stage_readiness where group_id = $1 and stage_index = $2 and student_id = $3", [group.id, group.stage_index, uid]);
    else await db.query(
      `insert into stage_readiness(group_id, stage_index, student_id, state) values ($1,$2,$3,$4)
       on conflict (group_id, stage_index, student_id) do update set state = excluded.state, updated_at = now()`,
      [group.id, group.stage_index, uid, state],
    );
    return { group, announceNeedTime: state === "need_time" && prev?.state !== "need_time" };
  });
  if (announceNeedTime) {
    // Group sees a neutral, unattributed note; teacher dashboard sees the count.
    await asServer((db) => db.query("insert into group_messages(group_id, kind, body) values ($1, 'system', 'Someone in your group would like a little more time — no rush.')", [group.id]));
    await notifyGroup(group, "message.new");
  }
  await notifyGroup(group, "group.readiness");
  await syncGroup(group.id);
}

// ---------------------------------------------------------------------------
// Ideas
// ---------------------------------------------------------------------------
export async function saveIdea(uid: string, sessionId: string, input: { id?: string; body: string; submit: boolean; buildsOn?: string | null }) {
  const body = input.body.trim();
  if (!body) throw badRequest("Write your idea first.");
  if (body.length > 1000) throw badRequest("Ideas can be up to 1000 characters.");
  const { group, shared } = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    requireActive(ctx);
    const kind = stageKind(ctx);
    const inBrainstorm = kind === "brainstorm";
    const laterStage = kind === "synthesis" || kind === "discussion" || kind === "voting";
    if (!inBrainstorm && !laterStage) throw conflict("Ideas can be added during thinking, synthesis, discussion and voting stages.");
    if (input.buildsOn) {
      const target = await db.maybeOne("select 1 from individual_ideas where id = $1 and group_id = $2 and shared", [input.buildsOn, group.id]);
      if (!target) throw badRequest("That idea isn't available to build on.");
    }
    // After the private thinking stage, new ideas go straight to the group.
    const shared = laterStage;
    const status = input.submit || laterStage ? "submitted" : "draft";
    if (input.id) {
      const existing = await db.maybeOne<{ shared: boolean }>("select shared from individual_ideas where id = $1 and author_id = $2", [input.id, uid]);
      if (!existing) throw new NotFoundError();
      if (existing.shared) throw conflict("This idea has already been shared with your group, so it can't be edited. You can add a new idea that builds on it.");
      await db.query("update individual_ideas set body = $2, status = $3 where id = $1 and author_id = $4", [input.id, body, status, uid]);
    } else {
      const count = await db.one<{ n: string }>("select count(*) as n from individual_ideas where group_id = $1 and author_id = $2", [group.id, uid]);
      if (Number(count.n) >= 20) throw badRequest("You've added lots of ideas already — try improving one instead.");
      await db.query(
        "insert into individual_ideas(group_id, author_id, stage_index, body, status, shared, builds_on) values ($1,$2,$3,$4,$5,$6,$7)",
        [group.id, uid, group.stage_index, body, status, shared, input.buildsOn ?? null],
      );
    }
    return { group, shared };
  });
  if (shared) await notifyGroup(group, "ideas.updated");
  else await publish([{ channel: ch.teacher(group.session_id), event: "ideas.updated", payload: { groupId: group.id } }, { channel: ch.user(uid), event: "ideas.updated" }]);
  await syncGroup(group.id);
}

export async function deleteIdea(uid: string, sessionId: string, ideaId: string) {
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    const row = await db.maybeOne<{ shared: boolean }>("select shared from individual_ideas where id = $1 and author_id = $2", [ideaId, uid]);
    if (!row) throw new NotFoundError();
    if (row.shared) throw conflict("Shared ideas stay with the group so nothing gets lost.");
    await db.query("delete from individual_ideas where id = $1 and author_id = $2", [ideaId, uid]);
    return group;
  });
  await publish([{ channel: ch.user(uid), event: "ideas.updated" }, { channel: ch.teacher(group.session_id), event: "ideas.updated", payload: { groupId: group.id } }]);
  await syncGroup(group.id);
}

/** Students can rename themes, move ideas between them, or add a theme. */
export async function editSynthesis(uid: string, sessionId: string, clusters: SynthesisCluster[], note: string) {
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    requireActive(ctx);
    const shared = await db.query<{ id: string }>("select id from individual_ideas where group_id = $1 and shared and status = 'submitted'", [group.id]);
    const valid = new Set(shared.map((s) => s.id));
    const cleaned = clusters
      .slice(0, 12)
      .map((c, i) => ({ id: `c${i + 1}`, title: c.title.trim().slice(0, 80) || `Theme ${i + 1}`, summary: c.summary.trim().slice(0, 300), ideaIds: [...new Set(c.ideaIds)].filter((id) => valid.has(id)) }))
      .filter((c) => c.ideaIds.length > 0);
    const covered = new Set(cleaned.flatMap((c) => c.ideaIds));
    const missing = [...valid].filter((id) => !covered.has(id));
    if (missing.length) cleaned.push({ id: `c${cleaned.length + 1}`, title: "Different angles", summary: "", ideaIds: missing });
    await db.query(
      `insert into idea_syntheses(group_id, version, origin, clusters, note, created_by)
       values ($1, coalesce((select max(version) from idea_syntheses where group_id = $1), 0) + 1, 'student_edit', $2, $3, $4)`,
      [group.id, JSON.stringify(cleaned), note.slice(0, 300), uid],
    );
    return group;
  });
  await notifyGroup(group, "synthesis.updated");
}

export async function requestResynthesis(uid: string, sessionId: string) {
  await rateLimit(`resynth:${uid}`, 3, 300);
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    requireActive(ctx);
    const group = requireGroup(ctx);
    const k = stageKind(ctx);
    if (k !== "synthesis" && k !== "discussion") throw conflict("Themes can be refreshed during the synthesis and discussion stages.");
    return group;
  });
  background(() => runSynthesis(group.id, { force: true }));
}

// ---------------------------------------------------------------------------
// Discussion
// ---------------------------------------------------------------------------
export async function postMessage(uid: string, sessionId: string, body: string, replyTo: string | null) {
  const text = body.trim();
  if (!text) throw badRequest("Write a message first.");
  if (text.length > 2000) throw badRequest("Messages can be up to 2000 characters.");
  await rateLimit(`msg:${uid}`, 30, 60);
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    if (ctx.session.status === "ended") throw conflict("This lesson has ended.");
    if (replyTo) {
      const ok = await db.maybeOne("select 1 from group_messages where id = $1 and group_id = $2", [replyTo, group.id]);
      if (!ok) throw badRequest("That message isn't in your group.");
    }
    await db.query("insert into group_messages(group_id, author_id, kind, body, reply_to) values ($1,$2,'student',$3,$4)", [group.id, uid, text, replyTo]);
    return group;
  });
  await notifyGroup(group, "message.new");
  background(() => checkParticipationBalance(group.id));
  // Talking to the group helper by name ("@Bloom …", "Bloom, …") gets a reply in the chat.
  if (mentionsHelper(text) && group.ai_enabled) {
    const allowed = await rateLimit(`ask-group:${uid}`, 8, 300).then(() => true, () => false);
    if (allowed) background(() => facilitate(group.id, { kind: "ask", quick: "question", question: text.slice(0, 500) }, null));
  }
}


export async function toggleReaction(uid: string, sessionId: string, messageId: string, kind: "applaud" | "agree" | "build" | "question") {
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    const msg = await db.maybeOne("select 1 from group_messages where id = $1 and group_id = $2", [messageId, group.id]);
    if (!msg) throw new NotFoundError();
    const removed = await db.query("delete from message_reactions where message_id = $1 and user_id = $2 and kind = $3 returning 1", [messageId, uid, kind]);
    if (!removed.length) await db.query("insert into message_reactions(message_id, user_id, kind) values ($1,$2,$3)", [messageId, uid, kind]);
    return group;
  });
  await notifyGroup(group, "message.reaction");
}

export async function togglePin(uid: string, sessionId: string, messageId: string) {
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    const row = await db.maybeOne("update group_messages set pinned = not pinned where id = $1 and group_id = $2 returning 1", [messageId, group.id]);
    if (!row) throw new NotFoundError();
    return group;
  });
  await notifyGroup(group, "message.pinned");
}

export async function toggleHand(uid: string, sessionId: string) {
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    const removed = await db.query("delete from hand_raises where group_id = $1 and student_id = $2 returning 1", [group.id, uid]);
    if (!removed.length) await db.query("insert into hand_raises(group_id, student_id) values ($1,$2)", [group.id, uid]);
    return group;
  });
  await notifyGroup(group, "group.hands");
}

export async function toggleVote(uid: string, sessionId: string, targetId: string) {
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    requireActive(ctx);
    const stage = ctx.session.snapshot.stages[group.stage_index];
    if (stage?.kind !== "voting") throw conflict("Voting is only open during the voting stage.");
    const valid = await db.maybeOne("select 1 from individual_ideas where id::text = $1 and group_id = $2 and shared", [targetId, group.id]);
    if (!valid) throw badRequest("You can only vote for ideas shared in your group.");
    const removed = await db.query("delete from votes where group_id = $1 and stage_index = $2 and voter_id = $3 and target_id = $4 returning 1", [group.id, group.stage_index, uid, targetId]);
    if (!removed.length) {
      const used = await db.one<{ n: string }>("select count(*) as n from votes where group_id = $1 and stage_index = $2 and voter_id = $3", [group.id, group.stage_index, uid]);
      if (Number(used.n) >= stage.config.votesPerStudent) throw conflict(`You've used all ${stage.config.votesPerStudent} of your votes. Remove one to vote for something else.`);
      await db.query("insert into votes(group_id, stage_index, voter_id, target_id) values ($1,$2,$3,$4)", [group.id, group.stage_index, uid, targetId]);
    }
    return group;
  });
  await notifyGroup(group, "votes.updated");
  await syncGroup(group.id);
}

export async function toggleCheckin(uid: string, sessionId: string, itemIndex: number) {
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    requireActive(ctx);
    const stage = ctx.session.snapshot.stages[group.stage_index];
    if (stage?.kind !== "physical" || itemIndex < 0 || itemIndex >= stage.config.checkins.length) throw badRequest("That check-in isn't part of this stage.");
    const removed = await db.query("delete from group_checkins where group_id = $1 and stage_index = $2 and item_index = $3 returning 1", [group.id, group.stage_index, itemIndex]);
    if (!removed.length) await db.query("insert into group_checkins(group_id, stage_index, item_index, done_by) values ($1,$2,$3,$4)", [group.id, group.stage_index, itemIndex, uid]);
    return group;
  });
  await notifyGroup(group, "checkins.updated");
  await syncGroup(group.id);
}

export async function askFacilitator(uid: string, sessionId: string, quick: Extract<FacilitatorTrigger, { kind: "ask" }>["quick"], question?: string) {
  await rateLimit(`ask-group:${uid}`, 8, 300);
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    requireActive(ctx);
    const group = requireGroup(ctx);
    if (!group.ai_enabled) throw conflict("Your teacher is facilitating your group directly right now. You can still use your private assistant or ask your teacher.");
    return group;
  });
  const labels = { explain_task: "asked Bloom to explain the task", discussion_question: "asked Bloom for a discussion question", we_disagree: "asked Bloom for help with a disagreement", we_are_stuck: "asked Bloom for help getting unstuck", question: "asked Bloom a question" };
  await asServer((db) => db.query("insert into group_messages(group_id, kind, body) values ($1, 'system', $2)", [group.id, `Your group ${labels[quick]}${quick === "question" && question ? `: “${question.slice(0, 200)}”` : "."}`]));
  await notifyGroup(group, "message.new");
  background(() => facilitate(group.id, { kind: "ask", quick, question: question?.slice(0, 500) }, null));
}

// ---------------------------------------------------------------------------
// Help, private messages
// ---------------------------------------------------------------------------
export async function createHelpRequest(uid: string, sessionId: string, reason: string, message: string) {
  await rateLimit(`help:${uid}`, 10, 600);
  const priority = reason === "uncomfortable" ? "urgent" : "normal";
  const row = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    return db.one<{ id: string }>(
      "insert into help_requests(session_id, group_id, student_id, reason, message, priority) values ($1,$2,$3,$4,$5,$6) returning id",
      [sessionId, ctx.group?.id ?? null, uid, reason, message.trim().slice(0, 1000), priority],
    );
  });
  // Teacher channel only — never the group or class channels.
  await publish([{ channel: ch.teacher(sessionId), event: "help.new", payload: { helpId: row.id, priority } }, { channel: ch.user(uid), event: "help.updated" }]);
  return row.id;
}

export async function messageTeacher(uid: string, sessionId: string, body: string, helpRequestId: string | null) {
  const text = body.trim().slice(0, 2000);
  if (!text) throw badRequest("Write a message first.");
  await rateLimit(`tmsg:${uid}`, 20, 300);
  await asUser(uid, async (db) => {
    await studentContext(db, uid, sessionId);
    if (helpRequestId) {
      const own = await db.maybeOne("select 1 from help_requests where id = $1 and student_id = $2", [helpRequestId, uid]);
      if (!own) throw new NotFoundError();
    }
    await db.query("insert into teacher_messages(session_id, student_id, sender_id, help_request_id, body) values ($1,$2,$2,$3,$4)", [sessionId, uid, helpRequestId, text]);
  });
  await publish([{ channel: ch.teacher(sessionId), event: "help.updated" }, { channel: ch.user(uid), event: "teacher_message.new" }]);
}

// ---------------------------------------------------------------------------
// Submission and presentation
// ---------------------------------------------------------------------------
export async function requestToPresent(uid: string, sessionId: string) {
  const group = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    const group = requireGroup(ctx);
    const sub = await db.maybeOne("select 1 from submissions where group_id = $1", [group.id]);
    if (!sub) throw conflict("Submit your work first, then you can ask to present it.");
    const pending = await db.maybeOne("select 1 from presentation_requests where group_id = $1 and status = 'pending'", [group.id]);
    if (pending) throw conflict("Your group has already asked to present — your teacher will decide.");
    await db.query("insert into presentation_requests(group_id, requested_by) values ($1,$2)", [group.id, uid]);
    return group;
  });
  await notifyGroup(group, "presentation.request");
}

export async function presenterNavigate(uid: string, sessionId: string, slide: number) {
  await asUser(uid, async (db) => {
    const s = await loadSession(db, sessionId);
    if (!s?.presentation || s.presentation.presenterId !== uid) throw forbidden("Your teacher controls the slides right now.");
    await asServer((sdb) => sdb.query("update activity_sessions set presentation = jsonb_set(presentation, '{slide}', to_jsonb($2::int)) where id = $1", [sessionId, Math.max(0, Math.min(200, Math.floor(slide)))]));
  });
  await publishPresentation(sessionId);
}

export async function submitReflection(uid: string, sessionId: string, ratings: Record<string, number>, answers: Record<string, string>) {
  await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    if (ctx.session.status !== "ended") throw conflict("Reflection opens when your teacher ends the lesson.");
    await db.query(
      `insert into reflection_responses(session_id, student_id, ratings, answers) values ($1,$2,$3,$4)
       on conflict (session_id, student_id) do update set ratings = excluded.ratings, answers = excluded.answers, submitted_at = now()`,
      [sessionId, uid, JSON.stringify(ratings), JSON.stringify(answers)],
    );
  });
  await publish([{ channel: ch.teacher(sessionId), event: "reflection.submitted" }]);
}

