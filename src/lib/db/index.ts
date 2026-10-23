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
    const p = new Pool({
      connectionString: config.databaseUrl,
      max: Number(process.env.BLOOM_DB_POOL_MAX ?? 10),
      // Close idle connections before the hosting network does, and keep
      // the rest alive, so a lesson never picks up a dead connection.
      idleTimeoutMillis: 10_000,
      keepAlive: true,
      connectionTimeoutMillis: 10_000,
    });
    // An idle connection dropped by the database is not a crash: the pool
    // discards it and opens a fresh one next time.
    p.on("error", (err) => console.warn("[bloom:db] idle connection closed:", err.message));
    globalThis.__bloomPool = p;
  }
  return globalThis.__bloomPool;
}

/** Errors that mean the connection itself broke (not a problem with the query). */
export function isConnectionError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return (
    ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT", "57P01", "57P02", "57P03", "08000", "08003", "08006"].includes(e?.code ?? "") ||
    /Connection terminated|connection timeout|Client has encountered a connection error|terminating connection/i.test(e?.message ?? "")
  );
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

async function transaction<T>(setup: (c: PoolClient) => Promise<void>, fn: (db: Db) => Promise<T>, attempt = 0): Promise<T> {
  const client = await pool().connect();
  let started = false;
  let broken: Error | undefined;
  try {
    await client.query("begin");
    started = true;
    await setup(client);
    const result = await fn(wrap(client));
    await client.query("commit");
    return result;
  } catch (err) {
    if (isConnectionError(err)) broken = err as Error;
    else await client.query("rollback").catch(() => {});
    // A dead connection fails at "begin" before anything ran: safe to retry once on a fresh one.
    if (broken && !started && attempt === 0) {
      client.release(broken);
      broken = undefined;
      return transaction(setup, fn, 1);
    }
    throw err;
  } finally {
    // Passing the error tells the pool to throw this connection away instead of reusing it.
    try { client.release(broken); } catch { /* already released for the retry */ }
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
