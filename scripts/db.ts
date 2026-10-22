/**
 * Database tooling.
 *   npm run db:migrate   apply pending migrations (and the local shim when BLOOM_AUTH_BACKEND=local)
 *   npm run db:reset     drop and recreate the public schema, then migrate + seed (LOCAL ONLY)
 *   npm run db:seed      load the fictional demo dataset
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { seed } from "./seed";

const url = process.env.DATABASE_URL ?? "postgres://postgres:bloom-local-dev@127.0.0.1:5432/bloom";
const root = path.resolve(__dirname, "..");
const isLocalBackend = (process.env.BLOOM_AUTH_BACKEND ?? "local") === "local";

export async function migrate(client: Client) {
  if (isLocalBackend) {
    await client.query(readFileSync(path.join(root, "supabase/local/00_supabase_shim.sql"), "utf8"));
  }
  await client.query(`create table if not exists public.bloom_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  await client.query("revoke all on public.bloom_migrations from public");
  const applied = new Set(
    (await client.query<{ name: string }>("select name from public.bloom_migrations")).rows.map((r) => r.name),
  );
  const dir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    process.stdout.write(`  applying ${file} … `);
    await client.query("begin");
    try {
      await client.query(readFileSync(path.join(dir, file), "utf8"));
      await client.query("insert into public.bloom_migrations(name) values ($1)", [file]);
      await client.query("commit");
      console.log("ok");
    } catch (err) {
      await client.query("rollback");
      console.log("FAILED");
      throw err;
    }
  }
}

export async function reset(client: Client) {
  if (!isLocalBackend || /supabase\.(co|com)/.test(url)) {
    throw new Error("db:reset only runs against the local development database");
  }
  await client.query(`
    drop schema if exists public cascade;
    drop schema if exists private cascade;
    drop schema if exists local_auth cascade;
    drop schema if exists auth cascade;
    create schema public;
    grant usage on schema public to public;
  `);
}

async function main() {
  const cmd = process.argv[2];
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    if (cmd === "reset") {
      await reset(client);
      await migrate(client);
      await seed(client);
    } else if (cmd === "migrate") {
      await migrate(client);
    } else if (cmd === "seed") {
      await seed(client);
    } else {
      throw new Error(`Unknown command ${cmd}`);
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
