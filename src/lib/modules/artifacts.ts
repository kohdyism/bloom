import "server-only";
import * as Y from "yjs";
import { asServer, asUser, NotFoundError, type Db } from "@/lib/db";
import { publish, ch } from "@/lib/realtime/server";
import { badRequest, conflict } from "@/lib/api";
import { documentToHtml, documentToText, readObjects, readSlides } from "@/lib/domain/artifact-model";
import { studentContext } from "./sessions/student";
import { notifyGroup, postSystem, syncGroup } from "./sessions/engine";
import { loadSession } from "./sessions/common";

const MAX_UPDATE_BYTES = 512 * 1024;
const COMPACT_AFTER = 150;
/** Updates small enough to ride along on the realtime hint (group channel only). */
const INLINE_UPDATE_BYTES = 6000;

type ArtifactRow = { id: string; group_id: string; kind: "document" | "whiteboard" | "slides"; snapshot: Buffer | null };

async function loadArtifact(db: Db, artifactId: string): Promise<ArtifactRow> {
  // RLS: only group members and the session teacher can select the row.
  const row = await db.maybeOne<ArtifactRow>("select id, group_id, kind, snapshot from collaborative_artifacts where id = $1", [artifactId]);
  if (!row) throw new NotFoundError();
  return row;
}

async function mergedState(db: Db, a: ArtifactRow): Promise<{ update: Uint8Array; lastId: number }> {
  const updates = await db.query<{ id: string; update: Buffer }>("select id, update from artifact_updates where artifact_id = $1 order by id", [a.id]);
  const parts: Uint8Array[] = [];
  if (a.snapshot) parts.push(new Uint8Array(a.snapshot));
  for (const u of updates) parts.push(new Uint8Array(u.update));
  const update = parts.length ? Y.mergeUpdates(parts) : Y.encodeStateAsUpdate(new Y.Doc());
  return { update, lastId: updates.length ? Number(updates[updates.length - 1].id) : 0 };
}

/** Full persisted state for (re)connecting clients. */
export async function getArtifactState(uid: string, artifactId: string) {
  return asUser(uid, async (db) => {
    const a = await loadArtifact(db, artifactId);
    const { update, lastId } = await mergedState(db, a);
    return { id: a.id, kind: a.kind, groupId: a.group_id, update: Buffer.from(update).toString("base64"), lastId };
  });
}

/**
 * Apply a client's Yjs update. Updates are append-only and idempotent
 * (client_update_id), so retries after a dropped connection never duplicate
 * or overwrite anyone's work.
 */
export async function applyArtifactUpdate(uid: string, artifactId: string, updateB64: string, clientUpdateId: string) {
  const bytes = Buffer.from(updateB64, "base64");
  if (!bytes.length || bytes.length > MAX_UPDATE_BYTES) throw badRequest("That change was too large to save. Try splitting it up.");
  try {
    Y.decodeUpdate(new Uint8Array(bytes));
  } catch {
    throw badRequest("That change couldn't be read.");
  }
  const result = await asUser(uid, async (db) => {
    const a = await loadArtifact(db, artifactId);
    const member = await db.maybeOne<{ session_id: string }>("select session_id from group_members where group_id = $1 and student_id = $2", [a.group_id, uid]);
    if (!member) throw new NotFoundError();
    const session = await loadSession(db, member.session_id);
    if (session?.status === "ended") throw conflict("This lesson has ended, so the work is now read-only. Nothing was lost.");
    const inserted = await db.query<{ id: string }>(
      "insert into artifact_updates(artifact_id, author_id, client_update_id, update) values ($1,$2,$3,$4) on conflict (artifact_id, client_update_id) do nothing returning id",
      [artifactId, uid, clientUpdateId.slice(0, 80), bytes],
    );
    await db.query("update collaborative_artifacts set updated_at = now() where id = $1", [artifactId]);
    return { a, id: inserted[0] ? Number(inserted[0].id) : null, sessionId: member.session_id };
  });
  if (result.id !== null) {
    await publish([{
      channel: ch.group(result.a.group_id),
      event: "artifact.update",
      payload: { artifactId, updateId: result.id, from: uid, ...(bytes.length <= INLINE_UPDATE_BYTES ? { update: updateB64 } : {}) },
    }]);
    if (result.id % 25 === 0) void maybeCompact(artifactId);
  }
  return { saved: true, updateId: result.id };
}

/** Merge old updates into the snapshot so loading stays fast. */
export async function maybeCompact(artifactId: string) {
  await asServer(async (db) => {
    const count = await db.one<{ n: string }>("select count(*) as n from artifact_updates where artifact_id = $1", [artifactId]);
    if (Number(count.n) < COMPACT_AFTER) return;
    const a = await db.one<ArtifactRow>("select id, group_id, kind, snapshot from collaborative_artifacts where id = $1 for update", [artifactId]);
    const { update, lastId } = await mergedState(db, a);
    await db.query("update collaborative_artifacts set snapshot = $2 where id = $1", [artifactId, Buffer.from(update)]);
    // Keep the most recent updates so reconnecting clients can still catch up by id.
    await db.query("delete from artifact_updates where artifact_id = $1 and id <= $2 - 20", [artifactId, lastId]);
  }).catch((e) => console.error("[bloom:artifacts] compaction failed", e));
}

async function docFor(db: Db, a: ArtifactRow): Promise<Y.Doc> {
  const doc = new Y.Doc();
  const { update } = await mergedState(db, a);
  Y.applyUpdate(doc, update);
  return doc;
}

/** Serialise the group's artifacts into a plain, server-rendered snapshot. */
export async function snapshotGroupWork(db: Db, groupId: string) {
  const artifacts = await db.query<ArtifactRow>("select id, group_id, kind, snapshot from collaborative_artifacts where group_id = $1", [groupId]);
  const content: Record<string, unknown> = {};
  const kinds: string[] = [];
  for (const a of artifacts) {
    const doc = await docFor(db, a);
    if (a.kind === "document") {
      const text = documentToText(doc);
      if (text) { content.document = { html: documentToHtml(doc), text }; kinds.push("document"); }
    } else if (a.kind === "whiteboard") {
      const objects = readObjects(doc.getMap("objects") as Y.Map<Y.Map<unknown>>);
      if (objects.length) { content.whiteboard = { objects }; kinds.push("whiteboard"); }
    } else if (a.kind === "slides") {
      const slides = readSlides(doc.getArray("slides") as Y.Array<Y.Map<unknown>>);
      if (slides.length) { content.slides = { slides }; kinds.push("slides"); }
    }
  }
  const media = await db.query<{ id: string; caption: string; mime_type: string }>("select id, caption, mime_type from media_uploads where group_id = $1 order by created_at", [groupId]);
  if (media.length) { content.media = media.map((m) => ({ id: m.id, caption: m.caption, mimeType: m.mime_type })); kinds.push("media"); }
  content.kinds = kinds;
  return content;
}

/** One member submits for the whole group; each submission is a new version. */
export async function submitGroupWork(uid: string, sessionId: string, note: string, expectedVersion: number) {
  const { group, version } = await asUser(uid, async (db) => {
    const ctx = await studentContext(db, uid, sessionId);
    if (!ctx.group) throw conflict("You aren't in a group yet.");
    if (ctx.session.status === "ended") throw conflict("This lesson has ended.");
    const group = ctx.group;
    // Serialise concurrent submissions from different members.
    await db.query("select pg_advisory_xact_lock(hashtext($1))", [group.id]);
    const latest = await db.maybeOne<{ version: number; status: string }>("select version, status from submissions where group_id = $1 order by version desc limit 1", [group.id]);
    const current = latest?.version ?? 0;
    if (current !== expectedVersion) throw conflict("Someone in your group has just submitted. Check the latest version before submitting again.", "stale_submission");
    if (latest && !ctx.session.snapshot.config.allowResubmission && latest.status !== "returned") {
      throw conflict("Your teacher has turned off resubmission for this lesson. Ask them if you need to change something.");
    }
    const content = await snapshotGroupWork(db, group.id);
    if (!(content.kinds as string[]).length && !note.trim()) throw badRequest("There's nothing to submit yet. Add to your shared work, a photo, or a note first.");
    await db.query("insert into submissions(group_id, version, submitted_by, content, note) values ($1,$2,$3,$4,$5)", [group.id, current + 1, uid, JSON.stringify(content), note.trim().slice(0, 2000)]);
    return { group, version: current + 1 };
  });
  await postSystem(group.id, [`Your group's work was submitted (version ${version}).`]);
  await notifyGroup(group, "submission.updated");
  await notifyGroup(group, "message.new");
  await syncGroup(group.id);
}

export async function teacherSubmission(uid: string, sessionId: string, submissionId: string) {
  return asUser(uid, async (db) => {
    const row = await db.maybeOne<{ id: string; group_id: string; version: number; status: string; content: Record<string, unknown>; feedback: string; note: string; created_at: Date; submitted_by: string }>(
      `select s.* from submissions s join session_groups g on g.id = s.group_id join activity_sessions a on a.id = g.session_id
       where s.id = $1 and a.id = $2 and a.teacher_id = $3`,
      [submissionId, sessionId, uid],
    );
    if (!row) throw new NotFoundError();
    return row;
  });
}
