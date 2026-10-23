import "server-only";
import { asServer, type Db } from "@/lib/db";
import { publish, ch } from "@/lib/realtime/server";
import { background } from "@/lib/background";
import { evaluateStage, type StageEvaluation, type StageSignals } from "@/lib/domain/stage-engine";
import type { Stage } from "@/lib/domain/lesson";
import { facilitatorMessage, type FacilitatorContext, type FacilitatorTrigger } from "@/lib/ai/facilitator";
import { synthesiseIdeas } from "@/lib/ai/synthesis";
import { FLOWERS, isFlowerId, pickFlower, type FlowerId } from "@/lib/domain/flowers";
import { loadGroup, loadSession, PRESENCE_WINDOW_SECONDS, type GroupRow, type SessionRow } from "./common";

/**
 * Server-authoritative progression. Runs with the server role, and is only
 * ever called after the caller's access to the group has been checked.
 */

export async function notifyGroup(group: { id: string; session_id: string }, event: string, extra: Record<string, unknown> = {}) {
  await publish([
    { channel: ch.group(group.id), event, payload: { groupId: group.id, ...extra } },
    { channel: ch.teacher(group.session_id), event, payload: { groupId: group.id } },
  ]);
}

/** Stage changes are public-safe (group name + stage index only). */
export async function notifyGroupProgress(group: { id: string; session_id: string }) {
  await publish([
    { channel: ch.group(group.id), event: "group.stage", payload: { groupId: group.id } },
    { channel: ch.teacher(group.session_id), event: "group.stage", payload: { groupId: group.id } },
    { channel: ch.session(group.session_id), event: "group.stage", payload: { groupId: group.id } },
    { channel: ch.display(group.session_id), event: "group.stage", payload: {} },
  ]);
}

export async function collectSignals(db: Db, group: GroupRow): Promise<StageSignals> {
  const members = await db.query<{ student_id: string; present: boolean }>(
    `select gm.student_id, (sp.last_seen_at > now() - make_interval(secs => $2)) as present
     from group_members gm left join session_participants sp on sp.session_id = gm.session_id and sp.student_id = gm.student_id
     where gm.group_id = $1`,
    [group.id, PRESENCE_WINDOW_SECONDS],
  );
  const idx = group.stage_index;
  const ready = await db.query<{ student_id: string; state: "ready" | "need_time" }>(
    "select student_id, state from stage_readiness where group_id = $1 and stage_index = $2",
    [group.id, idx],
  );
  const ideas = await db.query<{ author_id: string; n: string }>(
    "select author_id, count(*) as n from individual_ideas where group_id = $1 and status = 'submitted' group by author_id",
    [group.id],
  );
  const votes = await db.query<{ voter_id: string; n: string }>(
    "select voter_id, count(*) as n from votes where group_id = $1 and stage_index = $2 group by voter_id",
    [group.id, idx],
  );
  const roles = await db.query<{ student_id: string; n: string }>("select student_id, count(*) as n from group_roles where group_id = $1 group by student_id", [group.id]);
  const checkins = await db.one<{ n: string }>("select count(*) as n from group_checkins where group_id = $1 and stage_index = $2", [group.id, idx]);
  const synthesis = await db.maybeOne("select 1 from idea_syntheses where group_id = $1 limit 1", [group.id]);
  const submission = await db.maybeOne("select 1 from submissions where group_id = $1 limit 1", [group.id]);
  return {
    memberIds: members.map((m) => m.student_id),
    presentIds: members.filter((m) => m.present).map((m) => m.student_id),
    ready: Object.fromEntries(ready.map((r) => [r.student_id, r.state])),
    submittedIdeasBy: Object.fromEntries(ideas.map((r) => [r.author_id, Number(r.n)])),
    votesBy: Object.fromEntries(votes.map((r) => [r.voter_id, Number(r.n)])),
    rolesBy: Object.fromEntries(roles.map((r) => [r.student_id, Number(r.n)])),
    checkinsDone: Number(checkins.n),
    hasSynthesis: !!synthesis,
    hasSubmission: !!submission,
  };
}

export function currentStage(session: SessionRow, group: GroupRow): Stage | null {
  return session.snapshot.stages[group.stage_index] ?? null;
}

export async function evaluateGroup(db: Db, session: SessionRow, group: GroupRow): Promise<StageEvaluation | null> {
  const stage = currentStage(session, group);
  if (!stage) return null;
  return evaluateStage(stage, session.snapshot.config, await collectSignals(db, group));
}

/**
 * Re-evaluate a group after any signal changed: enter the ready check when
 * requirements are met, and advance when the readiness rule is satisfied.
 */
export async function syncGroup(groupId: string, opts: { quiet?: boolean } = {}): Promise<void> {
  const outcome = await asServer(async (db) => {
    const group = await db.maybeOne<GroupRow>("select * from session_groups where id = $1 for update", [groupId]);
    if (!group) return null;
    const session = await loadSession(db, group.session_id);
    if (!session || session.status !== "active" || group.paused || group.stage_status === "complete" || group.stage_status === "waiting") return null;
    const evaluation = await evaluateGroup(db, session, group);
    if (!evaluation) return null;
    if (evaluation.canAutoAdvance) return { advance: true as const, group };
    // Handing in the work right before presenting is the group's "we're done":
    // no extra ready taps. (Elsewhere the group stays, so it can revise if the
    // teacher returns the work.)
    const here = currentStage(session, group);
    const next = session.snapshot.stages[group.stage_index + 1];
    if (here?.kind === "submission" && next?.kind === "presentation" && here.config.completion !== "teacher_only" && evaluation.requirementsMet && evaluation.activeCount > 0) return { advance: true as const, group };
    if (evaluation.requirementsMet && group.stage_status === "active") {
      await db.query("update session_groups set stage_status = 'ready_check' where id = $1", [groupId]);
      // Only worth a message when the group actually had something to do first.
      const stage = currentStage(session, group);
      const hadWork = !!stage && ["brainstorm", "voting", "physical", "submission", "role_selection"].includes(stage.kind);
      return hadWork ? { readyCheck: true as const, group, session } : { changed: true as const, group };
    }
    if (!evaluation.requirementsMet && group.stage_status === "ready_check") {
      await db.query("update session_groups set stage_status = 'active' where id = $1", [groupId]);
    }
    return { changed: true as const, group };
  });
  if (!outcome) return;
  if ("advance" in outcome) {
    await advanceGroup(groupId, { by: "auto", fromIndex: outcome.group.stage_index });
    return;
  }
  if ("readyCheck" in outcome) {
    await notifyGroupProgress(outcome.group);
    const intensity = outcome.session!.snapshot.config.facilitationIntensity;
    if (intensity === "low" || !outcome.group.ai_enabled) {
      await postSystemMessage(outcome.group, "This stage's requirements are met. Tap “I'm ready” when your group is happy to move on, or “More time” if you need it.", `${outcome.group.stage_index}:ready_check`);
    } else {
      background(() => facilitate(groupId, { kind: "ready_check" }, `${outcome.group.stage_index}:ready_check`));
    }
    return;
  }
  if (!opts.quiet) await notifyGroup(outcome.group, "group.signals");
}

/**
 * System messages are authored by the server, never by a user, so they are
 * written with the server role (RLS forbids users from posting them).
 */
export async function postSystem(groupId: string, bodies: string[]) {
  if (!bodies.length) return;
  await asServer(async (db) => {
    for (const body of bodies) await db.query("insert into group_messages(group_id, kind, body) values ($1, 'system', $2)", [groupId, body]);
  });
}

async function postSystemMessage(group: GroupRow, body: string, dedupeKey?: string) {
  const posted = await asServer(async (db) => {
    if (dedupeKey) {
      const res = await db.query("insert into ai_interventions(group_id, trigger_key) values ($1, $2) on conflict do nothing returning 1", [group.id, `sys:${dedupeKey}`]);
      if (!res.length) return false;
    }
    await db.query("insert into group_messages(group_id, kind, body) values ($1, 'system', $2)", [group.id, body]);
    return true;
  });
  if (posted) await notifyGroup(group, "message.new");
}

/** Move a group to its next stage (or mark it complete). */
export async function advanceGroup(groupId: string, opts: { by: "auto" | "teacher"; actorId?: string; fromIndex: number }) {
  const result = await asServer(async (db) => {
    const group = await db.maybeOne<GroupRow>("select * from session_groups where id = $1 for update", [groupId]);
    if (!group) return null;
    // Compare-and-set: only advance from the stage the caller observed. A
    // concurrent request that already moved the group on makes this a no-op.
    if (group.stage_index !== opts.fromIndex || group.stage_status === "complete") return null;
    const session = await loadSession(db, group.session_id);
    if (!session || session.status === "ended") return null;
    const stages = session.snapshot.stages;
    const leaving = stages[group.stage_index];
    // Leaving individual thinking: submitted ideas become visible to the group.
    if (leaving?.kind === "brainstorm") {
      await db.query("update individual_ideas set shared = true where group_id = $1 and status = 'submitted'", [groupId]);
    }
    const nextIndex = group.stage_index + 1;
    const completed = nextIndex >= stages.length;
    const next = stages[nextIndex];
    const deadlineSql = completed || !next?.durationSeconds ? "null" : `now() + make_interval(secs => ${Number(next.durationSeconds)})`;
    await db.query(
      `update session_groups set
         stage_index = $2, stage_status = $3, stage_started_at = now(), stage_deadline = ${deadlineSql},
         remaining_seconds_on_pause = null, milestones = milestones + 1
       where id = $1`,
      [groupId, completed ? group.stage_index : nextIndex, completed ? "complete" : "active"],
    );
    await db.query(
      "insert into group_messages(group_id, kind, body) values ($1, 'system', $2)",
      [groupId, completed ? "Your group has completed every stage. Well done, all of you." : `Stage complete${opts.by === "teacher" ? " (moved on by your teacher)" : ""}. Next: ${next?.title}.`],
    );
    if (opts.by === "teacher" && opts.actorId) {
      await db.query("insert into audit_events(actor_id, session_id, action, target, details) values ($1,$2,'group.advanced',$3,$4)", [opts.actorId, session.id, groupId, JSON.stringify({ from: group.stage_index })]);
    }
    if (completed) await awardFlower(db, groupId);
    if (next?.kind === "creation") {
      for (const kind of next.config.artifacts) {
        await db.query("insert into collaborative_artifacts(group_id, kind) values ($1, $2) on conflict (group_id, kind) do nothing", [groupId, kind]);
      }
    }
    const fresh = await loadGroup(db, groupId);
    return { group: fresh!, session, next: completed ? null : next, completed };
  });
  if (!result) return;
  await notifyGroupProgress(result.group);
  await notifyGroup(result.group, "message.new");
  if (result.next) await onEnterStage(result.group, result.session, result.next);
}

export async function onEnterStage(group: GroupRow, session: SessionRow, stage: Stage) {
  if (stage.kind === "synthesis") {
    background(() => runSynthesis(group.id));
  }
  const intensity = session.snapshot.config.facilitationIntensity;
  if (group.ai_enabled && intensity !== "low") {
    background(() => facilitate(group.id, { kind: "stage_intro" }, `${group.stage_index}:intro`));
  }
}

/** Generate (or regenerate) the AI synthesis for a group's shared ideas. */
export async function runSynthesis(groupId: string, opts: { force?: boolean } = {}) {
  const ctx = await asServer(async (db) => {
    const group = await loadGroup(db, groupId);
    if (!group) return null;
    const session = await loadSession(db, group.session_id);
    if (!session) return null;
    if (!opts.force && (await db.maybeOne("select 1 from idea_syntheses where group_id = $1", [groupId]))) return null;
    await db.query("update individual_ideas set shared = true where group_id = $1 and status = 'submitted'", [groupId]);
    const ideas = await db.query<{ id: string; body: string }>(
      "select id, body from individual_ideas where group_id = $1 and status = 'submitted' and shared order by created_at",
      [groupId],
    );
    const stage = session.snapshot.stages[group.stage_index];
    return { group, session, ideas, stage };
  });
  if (!ctx) return;
  if (!ctx.ideas.length) {
    await asServer((db) =>
      db.query(
        `insert into idea_syntheses(group_id, version, origin, clusters, note)
         values ($1, coalesce((select max(version) from idea_syntheses where group_id = $1), 0) + 1, 'offline_helper', '[]', 'No ideas were shared yet.')`,
        [groupId],
      ),
    );
  } else {
    const { data, origin } = await synthesiseIdeas({
      ideas: ctx.ideas,
      objective: ctx.session.snapshot.objectives[0] ?? "",
      instructions: ctx.stage?.instructions ?? "",
    });
    await asServer((db) =>
      db.query(
        `insert into idea_syntheses(group_id, version, origin, clusters)
         values ($1, coalesce((select max(version) from idea_syntheses where group_id = $1), 0) + 1, $2, $3)`,
        [groupId, origin, JSON.stringify(data)],
      ),
    );
  }
  await notifyGroup(ctx.group, "synthesis.updated");
  await syncGroup(groupId);
}

const MAX_PROACTIVE_PER_STAGE = 4;

/**
 * Post a facilitator message for a deduplicated trigger. `dedupeKey` makes
 * each proactive intervention happen at most once, which (together with AI
 * messages never triggering AI) prevents intervention loops.
 */
export async function facilitate(groupId: string, trigger: FacilitatorTrigger, dedupeKey: string | null) {
  const prepared = await asServer(async (db) => {
    const group = await loadGroup(db, groupId);
    if (!group || !group.ai_enabled) return null;
    const session = await loadSession(db, group.session_id);
    if (!session || session.status !== "active" || group.paused) return null;
    if (dedupeKey) {
      if (trigger.kind !== "ask") {
        const count = await db.one<{ n: string }>("select count(*) as n from ai_interventions where group_id = $1 and trigger_key like $2", [groupId, `${group.stage_index}:%`]);
        if (Number(count.n) >= MAX_PROACTIVE_PER_STAGE && trigger.kind !== "stage_intro" && trigger.kind !== "ready_check") return null;
      }
      const inserted = await db.query("insert into ai_interventions(group_id, trigger_key) values ($1, $2) on conflict do nothing returning 1", [groupId, dedupeKey]);
      if (!inserted.length) return null;
    }
    return { group, session, ctx: await buildFacilitatorContext(db, session, group) };
  });
  if (!prepared) return;
  const { data, origin } = await facilitatorMessage(trigger, prepared.ctx);
  await asServer((db) => db.query("insert into group_messages(group_id, kind, ai_origin, body) values ($1, 'ai', $2, $3)", [groupId, origin, data.slice(0, 2000)]));
  await notifyGroup(prepared.group, "message.new");
}

/** Build the facilitator's context with members pseudonymised and no support data. */
export async function buildFacilitatorContext(db: Db, session: SessionRow, group: GroupRow): Promise<FacilitatorContext> {
  const stage = session.snapshot.stages[group.stage_index] ?? session.snapshot.stages[session.snapshot.stages.length - 1];
  const members = await db.query<{ student_id: string }>("select student_id from group_members where group_id = $1 order by student_id", [group.id]);
  const alias = new Map(members.map((m, i) => [m.student_id, `Member ${String.fromCharCode(65 + i)}`]));
  const ideas = await db.query<{ body: string }>("select body from individual_ideas where group_id = $1 and shared and status = 'submitted' order by created_at limit 30", [group.id]);
  const messages = await db.query<{ author_id: string | null; kind: string; body: string }>(
    "select author_id, kind, body from (select * from group_messages where group_id = $1 and kind in ('student','teacher') order by created_at desc limit 12) m order by created_at",
    [group.id],
  );
  const roles = await db.query<{ student_id: string; role_key: string }>("select student_id, role_key from group_roles where group_id = $1", [group.id]);
  const roleName = (k: string) => session.snapshot.config.roles.find((r) => r.key === k)?.name ?? k;
  return {
    lessonTitle: session.snapshot.title,
    objectives: session.snapshot.objectives,
    stage: { kind: stage.kind, title: stage.title, instructions: stage.instructions },
    nextStageTitle: session.snapshot.stages[group.stage_index + 1]?.title,
    materialsExcerpt: session.snapshot.materials.map((m) => `${m.title}: ${m.body}`).join("\n").slice(0, 1500),
    sharedIdeas: ideas.map((i) => i.body),
    recentMessages: messages.map((m) => ({ author: m.kind === "teacher" ? "Teacher" : alias.get(m.author_id ?? "") ?? "Member", body: m.body })),
    roles: roles.map((r) => ({ member: alias.get(r.student_id) ?? "Member", role: roleName(r.role_key) })),
    intensity: session.snapshot.config.facilitationIntensity,
    assistanceLevel: session.snapshot.config.facilitatorAssistanceLevel,
    outputType: session.snapshot.config.outputType,
  };
}

/**
 * Participation balance (moderate/high): if one voice wrote most of the recent
 * chat, invite broader participation — once per stage, without naming anyone.
 * Chat volume is never used for anything else (no scores, no labels).
 */
export async function checkParticipationBalance(groupId: string) {
  const check = await asServer(async (db) => {
    const group = await loadGroup(db, groupId);
    if (!group || !group.ai_enabled) return null;
    const session = await loadSession(db, group.session_id);
    if (!session || session.snapshot.config.facilitationIntensity === "low") return null;
    const stage = session.snapshot.stages[group.stage_index];
    if (!stage || stage.kind !== "discussion") return null;
    const size = await db.one<{ n: string }>("select count(*) as n from group_members where group_id = $1", [groupId]);
    if (Number(size.n) < 3) return null;
    const recent = await db.query<{ author_id: string }>(
      "select author_id from group_messages where group_id = $1 and kind = 'student' and created_at > coalesce($2, now() - interval '1 hour') order by created_at desc limit 10",
      [groupId, group.stage_started_at],
    );
    if (recent.length < 8) return null;
    const counts = new Map<string, number>();
    recent.forEach((r) => counts.set(r.author_id, (counts.get(r.author_id) ?? 0) + 1));
    const top = Math.max(...counts.values());
    const total = await db.one<{ n: string }>("select count(*) as n from group_messages where group_id = $1 and kind = 'student'", [groupId]);
    return { group, broaden: top / recent.length >= 0.7, offTaskCheck: session.snapshot.config.facilitationIntensity === "high" && Number(total.n) % 10 === 0, session, stage };
  });
  if (!check) return;
  if (check.broaden) await facilitate(groupId, { kind: "broaden_participation" }, `${check.group.stage_index}:broaden`);
  else if (check.offTaskCheck && (await looksOffTask(groupId, check.session, check.stage))) {
    await facilitate(groupId, { kind: "refocus" }, `${check.group.stage_index}:refocus:${Date.now() >> 18}`);
  }
}

/** Deterministic signal: recent messages share no vocabulary with the task or ideas. */
async function looksOffTask(groupId: string, session: SessionRow, stage: Stage) {
  const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const task = words([stage.instructions, ...session.snapshot.objectives, session.snapshot.title, ...session.snapshot.materials.map((m) => m.body)].join(" "));
  const recent = await asServer((db) => db.query<{ body: string }>("select body from group_messages where group_id = $1 and kind = 'student' order by created_at desc limit 8", [groupId]));
  const ideaWords = await asServer((db) => db.query<{ body: string }>("select body from individual_ideas where group_id = $1 and shared", [groupId]));
  ideaWords.forEach((i) => words(i.body).forEach((w) => task.add(w)));
  return recent.length >= 6 && recent.every((m) => [...words(m.body)].every((w) => !task.has(w)));
}

declare global {
  var __bloomTicks: Map<string, number> | undefined;
}

/**
 * Time-based checks, driven by students' realtime heartbeats (at most every
 * 15 s per session): gentle "no ideas yet" invitations, private nudges,
 * and time warnings. Nothing here moves a group on or removes work.
 */
export async function tickSession(sessionId: string) {
  globalThis.__bloomTicks ??= new Map();
  const last = globalThis.__bloomTicks.get(sessionId) ?? 0;
  if (Date.now() - last < 15_000) return;
  globalThis.__bloomTicks.set(sessionId, Date.now());

  const work = await asServer(async (db) => {
    const session = await loadSession(db, sessionId);
    if (!session || session.status !== "active") return [];
    const groups = await db.query<GroupRow>("select * from session_groups where session_id = $1 and not paused and stage_status in ('active','ready_check')", [sessionId]);
    const tasks: (() => Promise<void>)[] = [];
    const intensity = session.snapshot.config.facilitationIntensity;
    for (const g of groups) {
      // Someone may have left since the last signal: re-check whether the
      // group can now move on (absent members never hold a group up).
      tasks.push(() => syncGroup(g.id, { quiet: true }));
      const stage = session.snapshot.stages[g.stage_index];
      if (!stage || !g.stage_started_at || !g.stage_deadline) continue;
      const total = (g.stage_deadline.getTime() - g.stage_started_at.getTime()) / 1000;
      const elapsed = (Date.now() - g.stage_started_at.getTime()) / 1000;
      const remaining = total - elapsed;
      const frac = total > 0 ? elapsed / total : 0;
      if (!g.ai_enabled) continue;
      if (stage.kind === "brainstorm" && intensity !== "low" && frac >= 0.4) {
        const any = await db.maybeOne("select 1 from individual_ideas where group_id = $1 and status = 'submitted'", [g.id]);
        if (!any) tasks.push(() => facilitate(g.id, { kind: "no_ideas_yet" }, `${g.stage_index}:no_ideas`));
      }
      if (stage.kind === "brainstorm" && intensity !== "low" && frac >= 0.5) {
        tasks.push(() => privateNudges(g, frac));
      }
      const warn = session.snapshot.config.timerWarningSeconds;
      if (intensity === "high" && warn > 0 && remaining > 0 && remaining <= warn) {
        tasks.push(() => facilitate(g.id, { kind: "time_warning", minutes: Math.max(1, Math.round(remaining / 60)) }, `${g.stage_index}:time_warning`));
      }
    }
    return tasks;
  });
  for (const t of work) await t();
}

/**
 * The group's plant opens into a flower (once). Chosen from the ones its
 * members have collected least, so each bloom tends to be a new one for them.
 */
export async function awardFlower(db: Db, groupId: string): Promise<FlowerId | null> {
  const existing = await db.maybeOne<{ flower: string | null }>("select flower from session_groups where id = $1", [groupId]);
  if (!existing) return null;
  if (isFlowerId(existing.flower)) return existing.flower;
  const rows = await db.query<{ flowers: string[] | null }>(
    `select array_remove(array_agg(g2.flower), null) as flowers
     from group_members gm
     left join group_members gm2 on gm2.student_id = gm.student_id
     left join session_groups g2 on g2.id = gm2.group_id and g2.id <> $1
     where gm.group_id = $1
     group by gm.student_id`,
    [groupId],
  );
  const flower = pickFlower(groupId, rows.map((r) => (r.flowers ?? []).filter(isFlowerId)));
  await db.query("update session_groups set flower = $2 where id = $1 and flower is null", [groupId, flower]);
  return flower;
}
export const FLOWER_COUNT = FLOWERS.length;

/** After a student leaves: their group may now be able to move on. */
export async function syncStudentGroup(sessionId: string, studentId: string) {
  const row = await asServer((db) => db.maybeOne<{ group_id: string }>(
    "select gm.group_id from group_members gm join session_groups g on g.id = gm.group_id where g.session_id = $1 and gm.student_id = $2",
    [sessionId, studentId],
  ));
  if (row) await syncGroup(row.group_id);
}

/**
 * A private, pressure-free invitation for members who haven't added an idea
 * yet. It goes to their own assistant panel, never the group, and respects
 * their stated reminder preference and any extra-thinking-time support.
 */
async function privateNudges(group: GroupRow, frac: number) {
  const targets = await asServer(async (db) => {
    const rows = await db.query<{ student_id: string; reminders: string | null; extra_time: boolean }>(
      `select gm.student_id, sp.survey ->> 'reminders' as reminders,
              exists (select 1 from student_accommodations a where a.student_id = gm.student_id and a.kind = 'extra_processing_time') as extra_time
       from group_members gm left join student_preferences sp on sp.student_id = gm.student_id
       where gm.group_id = $1
         and not exists (select 1 from individual_ideas i where i.group_id = gm.group_id and i.author_id = gm.student_id and i.status = 'submitted')
         and not exists (select 1 from stage_readiness r where r.group_id = gm.group_id and r.stage_index = $2 and r.student_id = gm.student_id)`,
      [group.id, group.stage_index],
    );
    const out: string[] = [];
    for (const r of rows) {
      if (r.reminders === "no") continue;
      if (r.extra_time && frac < 0.75) continue;
      const ins = await db.query("insert into ai_interventions(group_id, trigger_key) values ($1, $2) on conflict do nothing returning 1", [group.id, `${group.stage_index}:nudge:${r.student_id}`]);
      if (!ins.length) continue;
      await db.query(
        `insert into private_ai_messages(student_id, session_id, role, action, origin, body)
         values ($1, $2, 'assistant', 'nudge', 'facilitator_nudge', $3)`,
        [r.student_id, group.session_id, "Just checking in, privately: no rush at all. If it helps, jot down even a word or phrase — or if you'd rather share out loud with your group, tap “I'm ready” when you've had your say. I can also explain the task in steps."],
      );
      out.push(r.student_id);
    }
    return out;
  });
  if (targets.length) await publish(targets.map((id) => ({ channel: ch.user(id), event: "private_ai.new", payload: {} })));
}
