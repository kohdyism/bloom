import "server-only";
import { randomBytes } from "node:crypto";
import type { Db } from "@/lib/db";
import { sessionSnapshotSchema, type SessionSnapshot } from "@/lib/domain/lesson";

export type SessionRow = {
  id: string;
  lesson_id: string;
  class_id: string;
  teacher_id: string;
  status: "lobby" | "active" | "paused" | "ended";
  groups_approved: boolean;
  join_code: string;
  join_code_expires_at: Date;
  display_token: string;
  snapshot: SessionSnapshot;
  presentation: Presentation | null;
  started_at: Date | null;
  paused_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
};

export type Presentation = {
  groupId: string;
  submissionId: string;
  view: "document" | "whiteboard" | "slides" | "media";
  slide: number;
  presenterId: string | null;
  startedAt: string;
};

export type GroupRow = {
  id: string;
  session_id: string;
  name: string;
  color: string;
  position: number;
  stage_index: number;
  stage_status: "waiting" | "active" | "ready_check" | "complete";
  flower: string | null;
  stage_started_at: Date | null;
  stage_deadline: Date | null;
  remaining_seconds_on_pause: number | null;
  paused: boolean;
  ai_enabled: boolean;
  milestones: number;
};

export async function loadSession(db: Db, sessionId: string): Promise<SessionRow | null> {
  const row = await db.maybeOne<SessionRow>("select * from activity_sessions where id = $1", [sessionId]);
  if (!row) return null;
  row.snapshot = sessionSnapshotSchema.parse(row.snapshot);
  return row;
}

export async function loadGroup(db: Db, groupId: string): Promise<GroupRow | null> {
  return db.maybeOne<GroupRow>("select * from session_groups where id = $1", [groupId]);
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function makeJoinCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}
export function makeDisplayToken(): string {
  return randomBytes(18).toString("base64url");
}

export const GROUP_NAMES = ["Willow", "Juniper", "Maple", "Cedar", "Rowan", "Hazel", "Aspen", "Linden", "Alder", "Birch", "Elm", "Sorrel"];
export const GROUP_COLORS = ["teal", "blue", "purple", "mint", "coral", "amber"];

/** Students counted as present if their realtime connection pinged recently. */
export const PRESENCE_WINDOW_SECONDS = 50;
