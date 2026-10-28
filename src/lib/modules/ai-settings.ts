import "server-only";
import { z } from "zod";
import { asServer, asUser } from "@/lib/db";

/**
 * A teacher's AI controls across all their lessons: extra instructions Bloom
 * and Pip always follow, banned words (held back in the chat, ideas and Pip),
 * and whether ideas are checked before the group sees them.
 */
export const aiSettingsSchema = z.object({
  instructions: z.string().max(2000).default(""),
  bannedWords: z.array(z.string().trim().min(1).max(40)).max(100).default([]),
  ideaCheck: z.boolean().default(true),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;
export const DEFAULT_AI_SETTINGS: AiSettings = { instructions: "", bannedWords: [], ideaCheck: true };

type Row = { instructions: string; banned_words: string[]; idea_check: boolean };
const fromRow = (r: Row | null): AiSettings => (r ? { instructions: r.instructions, bannedWords: r.banned_words, ideaCheck: r.idea_check } : DEFAULT_AI_SETTINGS);

export async function myAiSettings(uid: string): Promise<AiSettings> {
  return asUser(uid, async (db) => fromRow(await db.maybeOne<Row>("select instructions, banned_words, idea_check from teacher_ai_settings where teacher_id = $1", [uid])));
}

export async function saveAiSettings(uid: string, input: AiSettings) {
  const s = aiSettingsSchema.parse(input);
  const words = [...new Map(s.bannedWords.map((w) => [w.toLowerCase(), w])).values()];
  await asUser(uid, (db) => db.query(
    `insert into teacher_ai_settings(teacher_id, instructions, banned_words, idea_check, updated_at) values ($1,$2,$3,$4, now())
     on conflict (teacher_id) do update set instructions = excluded.instructions, banned_words = excluded.banned_words, idea_check = excluded.idea_check, updated_at = now()`,
    [uid, s.instructions.trim(), words, s.ideaCheck],
  ));
}

/** The settings of the teacher running a lesson (read by the server when moderating or prompting). */
export async function aiSettingsForSession(sessionId: string): Promise<AiSettings> {
  return asServer(async (db) => fromRow(await db.maybeOne<Row>(
    "select t.instructions, t.banned_words, t.idea_check from activity_sessions s join teacher_ai_settings t on t.teacher_id = s.teacher_id where s.id = $1",
    [sessionId],
  )));
}
