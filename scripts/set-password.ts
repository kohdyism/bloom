/**
 * Set a user's password (local auth backend).
 *
 *   npx tsx scripts/set-password.ts <username>
 *
 * Prompts for the new password so it never appears in shell history or logs.
 * On Fly.io:  fly ssh console -a <app>   then   cd /app && npx tsx scripts/set-password.ts teacher.demo
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { Client } from "pg";
import { hashPassword } from "../src/lib/auth/password";

function ask(question: string, hidden: boolean): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
    muted = hidden;
  });
}

async function main() {
  const username = process.argv[2]?.trim().toLowerCase();
  if (!username) throw new Error("Usage: npx tsx scripts/set-password.ts <username>");
  if ((process.env.BLOOM_AUTH_BACKEND ?? "local") !== "local") {
    throw new Error("This script is for the local auth backend. With Supabase, change passwords in Supabase Auth.");
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string; display_name: string }>(
      "select id, display_name from public.profiles where username = $1",
      [username],
    );
    if (!rows[0]) throw new Error(`No user called ${username}`);
    const pw = await ask(`New password for ${username} (${rows[0].display_name}): `, true);
    const again = await ask("Type it again: ", true);
    if (pw !== again) throw new Error("The passwords didn't match — nothing changed.");
    if (pw.length < 10) throw new Error("Use at least 10 characters — nothing changed.");
    await client.query(
      `insert into local_auth.credentials(user_id, password_hash) values ($1, $2)
       on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`,
      [rows[0].id, await hashPassword(pw)],
    );
    console.log(`Password updated for ${username}.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
