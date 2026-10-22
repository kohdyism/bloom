import "server-only";
import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { asServer } from "@/lib/db";
import { hashPassword } from "./password";

const COLORS = ["teal", "blue", "purple", "mint", "coral", "amber"];

/**
 * Creates a teacher-managed student account. Called only after the caller has
 * been verified as the teacher of the target class.
 */
export async function provisionStudentAccount(input: { username: string; displayName: string; password: string }): Promise<string> {
  const username = input.username.trim().toLowerCase();
  const email = `${username}@students.bloom.demo`;
  let userId: string;
  if (config.authBackend === "supabase") {
    // Supabase Auth admin API (service role key, server only). Not exercised by
    // the local test-suite.
    const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({ email, password: input.password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? "Could not create account");
    userId = data.user.id;
  } else {
    userId = await asServer(async (db) => {
      const row = await db.one<{ id: string }>("insert into auth.users(email) values ($1) returning id", [email]);
      await db.query("insert into local_auth.credentials(user_id, password_hash) values ($1, $2)", [row.id, await hashPassword(input.password)]);
      return row.id;
    });
  }
  await asServer((db) =>
    db.query(
      `insert into profiles(id, role, display_name, username, avatar_color, avatar_icon)
       values ($1, 'student', $2, $3, $4, 'leaf')`,
      [userId, input.displayName.trim(), username, COLORS[Math.floor(Math.random() * COLORS.length)]],
    ),
  );
  return userId;
}

export async function resetLocalPassword(userId: string, password: string) {
  if (config.authBackend === "supabase") {
    const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false } });
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw new Error(error.message);
    return;
  }
  const hash = await hashPassword(password);
  await asServer((db) =>
    db.query(
      `insert into local_auth.credentials(user_id, password_hash) values ($1, $2)
       on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`,
      [userId, hash],
    ),
  );
}
