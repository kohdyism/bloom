import "server-only";
import { Client } from "pg";
import { config } from "@/lib/config";
import { asServer, asUser } from "@/lib/db";

/**
 * Realtime fan-out.
 *
 * Durable state always lives in its own tables. After a change commits, the
 * server appends a small *hint* to public.realtime_events (ids and event
 * names, never protected content — Yjs updates on a group channel are the one
 * payload-carrying exception, and group channels are member-only). An insert
 * trigger fires pg_notify; every app instance LISTENs, reads the row, and
 * pushes it to the SSE connections subscribed to that channel. Clients that
 * miss events (reconnects, sleeping tablets) replay them by id.
 *
 * Channels
 *   session:<id>   teacher + participants   status, stage progress, presentation, class announcements
 *   teacher:<id>   session teacher only      help requests, presence, joins
 *   group:<id>     group members + teacher   chat, ideas, readiness, artifacts, submissions
 *   user:<id>      that user only            private messages, help status, private nudges
 *   display:<id>   classroom display token   public-safe projection changes
 */

export type RealtimeEvent = { id: number; channel: string; event: string; payload: Record<string, unknown> };
type Listener = (e: RealtimeEvent) => void;

type Hub = { client: Client | null; listeners: Map<string, Set<Listener>>; connecting: Promise<void> | null };

declare global {
  var __bloomRealtime: Hub | undefined;
}

function hub(): Hub {
  if (!globalThis.__bloomRealtime) globalThis.__bloomRealtime = { client: null, listeners: new Map(), connecting: null };
  return globalThis.__bloomRealtime;
}

async function ensureListening() {
  const h = hub();
  if (h.client) return;
  if (h.connecting) return h.connecting;
  h.connecting = (async () => {
    const client = new Client({ connectionString: config.databaseUrl });
    client.on("error", (err) => {
      console.error("[bloom:realtime] listener error, reconnecting", err.message);
      h.client = null;
      h.connecting = null;
      setTimeout(() => ensureListening().catch(() => {}), 1000);
    });
    client.on("notification", async (msg) => {
      const id = Number(msg.payload);
      if (!Number.isFinite(id)) return;
      try {
        const res = await asServer((db) =>
          db.maybeOne<{ id: string; channel: string; event: string; payload: Record<string, unknown> }>(
            "select id, channel, event, payload from realtime_events where id = $1",
            [id],
          ),
        );
        if (!res) return;
        const evt: RealtimeEvent = { id: Number(res.id), channel: res.channel, event: res.event, payload: res.payload };
        h.listeners.get(evt.channel)?.forEach((fn) => fn(evt));
      } catch (err) {
        console.error("[bloom:realtime] dispatch failed", err);
      }
    });
    await client.connect();
    await client.query("listen bloom_realtime");
    h.client = client;
  })();
  try {
    await h.connecting;
  } finally {
    h.connecting = null;
  }
}

export function subscribe(channels: string[], fn: Listener): () => void {
  const h = hub();
  void ensureListening();
  for (const c of channels) {
    if (!h.listeners.has(c)) h.listeners.set(c, new Set());
    h.listeners.get(c)!.add(fn);
  }
  return () => {
    for (const c of channels) {
      const set = h.listeners.get(c);
      set?.delete(fn);
      if (set && set.size === 0) h.listeners.delete(c);
    }
  };
}

export async function ready() {
  await ensureListening();
}

/** Publish hint events. Call after the state change has committed. */
export async function publish(events: { channel: string; event: string; payload?: Record<string, unknown> }[]) {
  if (!events.length) return;
  await asServer(async (db) => {
    for (const e of events) {
      await db.query("insert into realtime_events(channel, event, payload) values ($1, $2, $3)", [e.channel, e.event, JSON.stringify(e.payload ?? {})]);
    }
  });
}

export async function replay(channels: string[], afterId: number, limit = 500): Promise<RealtimeEvent[]> {
  const rows = await asServer((db) =>
    db.query<{ id: string; channel: string; event: string; payload: Record<string, unknown> }>(
      "select id, channel, event, payload from realtime_events where channel = any($1) and id > $2 order by id limit $3",
      [channels, afterId, limit],
    ),
  );
  return rows.map((r) => ({ id: Number(r.id), channel: r.channel, event: r.event, payload: r.payload }));
}

export async function latestEventId(): Promise<number> {
  const row = await asServer((db) => db.one<{ id: string | null }>("select max(id) as id from realtime_events"));
  return Number(row.id ?? 0);
}

/** Decide, server-side, whether `userId` may subscribe to `channel`. */
export async function canSubscribe(userId: string, channel: string): Promise<boolean> {
  const [kind, id] = channel.split(":");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  if (kind === "user") return id === userId;
  return asUser(userId, async (db) => {
    if (kind === "session") {
      const r = await db.maybeOne<{ ok: boolean }>("select private.is_session_teacher($1) or private.is_session_participant($1) as ok", [id]);
      return !!r?.ok;
    }
    if (kind === "teacher") {
      const r = await db.maybeOne<{ ok: boolean }>("select private.is_session_teacher($1) as ok", [id]);
      return !!r?.ok;
    }
    if (kind === "group") {
      const r = await db.maybeOne<{ ok: boolean }>("select private.is_group_member($1) or private.is_group_teacher($1) as ok", [id]);
      return !!r?.ok;
    }
    return false;
  });
}

export const ch = {
  session: (id: string) => `session:${id}`,
  teacher: (id: string) => `teacher:${id}`,
  group: (id: string) => `group:${id}`,
  user: (id: string) => `user:${id}`,
  display: (id: string) => `display:${id}`,
};
