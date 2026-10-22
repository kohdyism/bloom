import { getCurrentUser } from "@/lib/auth/current-user";
import { asServer } from "@/lib/db";
import { canSubscribe, ch, latestEventId, publish, ready, replay, subscribe, type RealtimeEvent } from "@/lib/realtime/server";
import { syncStudentGroup, tickSession } from "@/lib/modules/sessions/engine";

export const dynamic = "force-dynamic";

declare global {
  var __canopyConnections: Map<string, number> | undefined;
}
export const runtime = "nodejs";

const HEARTBEAT_MS = 20_000;
const LEAVE_GRACE_MS = 5_000;

/**
 * Server-Sent Events stream.
 *   GET /api/realtime?channels=session:<id>,group:<id>&presence=<sessionId>
 *   GET /api/realtime?display=<token>            (classroom display, no user)
 * Every requested channel is authorised individually; one unauthorised
 * channel rejects the whole request. Missed events are replayed using the
 * standard Last-Event-ID header (sent automatically by EventSource).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const displayToken = url.searchParams.get("display");
  let channels: string[];
  let presence: { sessionId: string; userId: string } | null = null;

  if (displayToken) {
    const session = await asServer((db) =>
      db.maybeOne<{ id: string }>("select id from activity_sessions where display_token = $1", [displayToken]),
    );
    if (!session) return new Response("Not found", { status: 404 });
    channels = [ch.display(session.id)];
  } else {
    const user = await getCurrentUser();
    if (!user) return new Response("Unauthenticated", { status: 401 });
    channels = (url.searchParams.get("channels") ?? "").split(",").map((c) => c.trim()).filter(Boolean).slice(0, 8);
    if (!channels.length) return new Response("No channels", { status: 400 });
    for (const c of channels) {
      if (!(await canSubscribe(user.id, c))) return new Response("Forbidden", { status: 403 });
    }
    const p = url.searchParams.get("presence");
    if (p && user.role === "student" && channels.includes(ch.session(p))) presence = { sessionId: p, userId: user.id };
  }

  await ready();
  const lastEventHeader = req.headers.get("last-event-id") ?? url.searchParams.get("since");
  const since = lastEventHeader ? Number(lastEventHeader) : null;
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const sendEvent = (e: RealtimeEvent) => send(`id: ${e.id}\nevent: message\ndata: ${JSON.stringify({ channel: e.channel, event: e.event, payload: e.payload })}\n\n`);

      // Buffer live events until replay finishes so ordering is preserved.
      const buffered: RealtimeEvent[] = [];
      let replaying = true;
      let lastSent = since ?? 0;
      const unsubscribe = subscribe(channels, (e) => {
        if (replaying) buffered.push(e);
        else if (e.id > lastSent) { lastSent = e.id; sendEvent(e); }
      });

      send(`retry: 2000\n\n`);
      if (since !== null && Number.isFinite(since)) {
        const missed = await replay(channels, since);
        for (const e of missed) { lastSent = Math.max(lastSent, e.id); sendEvent(e); }
        if (missed.length) send(`event: replayed\ndata: ${JSON.stringify({ count: missed.length })}\n\n`);
      } else {
        lastSent = await latestEventId();
        send(`id: ${lastSent}\nevent: ready\ndata: {}\n\n`);
      }
      replaying = false;
      for (const e of buffered) if (e.id > lastSent) { lastSent = e.id; sendEvent(e); }

      // Count this student's open connections. A page swapping connections
      // (channel change, reconnect, reload) briefly has none, so leaving is
      // only recorded after a short grace period with no connection at all.
      const presenceKey = presence ? `${presence.sessionId}:${presence.userId}` : "";
      const open = (globalThis.__canopyConnections ??= new Map<string, number>());
      if (presence) open.set(presenceKey, (open.get(presenceKey) ?? 0) + 1);
      const touchPresence = async (event: "presence.online" | "presence.offline" | null) => {
        if (!presence) return;
        // Leaving (tab closed) counts as away straight away, so a student who
        // has gone never holds their group up.
        const seen = event === "presence.offline" ? "now() - interval '1 hour'" : "now()";
        await asServer((db) =>
          db.query(`update session_participants set last_seen_at = ${seen} where session_id = $1 and student_id = $2`, [presence!.sessionId, presence!.userId]),
        ).catch(() => {});
        if (event) await publish([{ channel: ch.teacher(presence.sessionId), event, payload: { studentId: presence.userId } }]).catch(() => {});
      };
      const leave = () => {
        if (!presence) return;
        const left = (open.get(presenceKey) ?? 1) - 1;
        if (left > 0) { open.set(presenceKey, left); return; }
        open.delete(presenceKey);
        setTimeout(() => {
          if (open.has(presenceKey)) return; // came straight back
          void touchPresence("presence.offline").then(() => syncStudentGroup(presence!.sessionId, presence!.userId)).catch(() => {});
        }, LEAVE_GRACE_MS);
      };
      void touchPresence("presence.online");

      const heartbeat = setInterval(() => {
        send(`: keep-alive\n\n`);
        void touchPresence(null);
        // Time-based facilitator checks piggy-back on student heartbeats.
        if (presence) void tickSession(presence.sessionId).catch((e) => console.error("[bloom:tick]", e));
      }, HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        leave();
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
