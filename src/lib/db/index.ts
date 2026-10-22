import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { config } from "@/lib/config";

/**
 * Database access.
 *
 * Two entry points, deliberately different:
 *
 *  - `asUser(userId, fn)` runs `fn` inside a transaction with
 *    `role authenticated` and the user's JWT claims set. Every query in that
 *    transaction is filtered by the row-level-security policies in
 *    supabase/migrations. This is the default for all user-initiated reads and
 *    writes.
 *
 *  - `asServer(fn)` runs as `service_role` (bypasses RLS). It is used only for
 *    server-authoritative operations *after* the caller has been authorised in
 *    application code: stage transitions, AI-authored messages, the realtime
 *    event log, rate limits and seeding.
 */

declare global {
  var __bloomPool: Pool | undefined;
}

export function pool(): Pool {
  if (!globalThis.__bloomPool) {
    globalThis.__bloomPool = new Pool({
      connectionString: config.databaseUrl,
      max: Number(process.env.BLOOM_DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
    });
  }
  return globalThis.__bloomPool;
}

export type Db = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
  one<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T>;
  maybeOne<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T | null>;
  client: PoolClient;
};

function wrap(client: PoolClient): Db {
  return {
    client,
    async query(text, params) {
      const res = await client.query(text, params as unknown[]);
      return res.rows;
    },
    async one(text, params) {
      const res = await client.query(text, params as unknown[]);
      if (res.rows.length !== 1) throw new NotFoundError();
      return res.rows[0];
    },
    async maybeOne(text, params) {
      const res = await client.query(text, params as unknown[]);
      return res.rows[0] ?? null;
    },
  };
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

async function transaction<T>(setup: (c: PoolClient) => Promise<void>, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    await setup(client);
    const result = await fn(wrap(client));
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function asUser<T>(userId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Invalid user id");
  return transaction(async (c) => {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
  }, fn);
}

export function asServer<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return transaction(async (c) => {
    await c.query("set local role service_role");
  }, fn);
}
