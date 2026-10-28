import "server-only";
import { asServer, asUser, NotFoundError } from "@/lib/db";
import { publish, ch } from "@/lib/realtime/server";
import type { FlagCategory } from "@/lib/domain/moderation";

/**
 * Teacher flags: moderation in the group chat or Pip caught something.
 * The student is told kindly at the time; the teacher sees who, which kind
 * and when, and can reveal the words on purpose.
 */
export async function raiseFlag(input: { sessionId: string; groupId: string | null; studentId: string; source: "chat" | "pip" | "idea"; category: FlagCategory; excerpt: string }) {
  await asServer((db) => db.query(
    "insert into student_flags(session_id, group_id, student_id, source, category, excerpt) values ($1,$2,$3,$4,$5,$6)",
    [input.sessionId, input.groupId, input.studentId, input.source, input.category, input.excerpt.trim().slice(0, 600)],
  ));
  await publish([{ channel: ch.teacher(input.sessionId), event: "flags.updated", payload: { category: input.category } }]);
}

export async function reviewFlag(uid: string, sessionId: string, flagId: string) {
  const ok = await asUser(uid, (db) => db.maybeOne("update student_flags set reviewed_at = now() where id = $1 and session_id = $2 returning id", [flagId, sessionId]));
  if (!ok) throw new NotFoundError();
  await publish([{ channel: ch.teacher(sessionId), event: "flags.updated" }]);
}
