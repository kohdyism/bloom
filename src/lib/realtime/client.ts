"use client";

import { useEffect, useRef, useState } from "react";

export type ClientEvent = { channel: string; event: string; payload: Record<string, unknown> };
export type ConnectionState = "connecting" | "open" | "reconnecting" | "offline";

/**
 * Subscribe to authorised realtime channels over SSE. EventSource reconnects
 * automatically and resends Last-Event-ID, so the server replays anything
 * missed. `onResync` fires after every (re)connection so callers can refetch
 * their authoritative state from the server — realtime is only a hint.
 */
export function useRealtime(
  opts: { channels?: string[]; display?: string; presence?: string; enabled?: boolean },
  onEvent: (e: ClientEvent) => void,
  onResync?: () => void,
): ConnectionState {
  const [state, setState] = useState<ConnectionState>("connecting");
  const handler = useRef(onEvent);
  const resync = useRef(onResync);
  // Survive channel changes: a replacement connection resumes from the last
  // event we saw (server replays the gap) and triggers one refetch on open.
  const lastId = useRef<string | null>(null);
  const connections = useRef(0);
  useEffect(() => {
    handler.current = onEvent;
    resync.current = onResync;
  });

  const key = opts.display ? `display=${opts.display}` : (opts.channels ?? []).join(",");
  const enabled = opts.enabled ?? true;

  useEffect(() => {
    if (!enabled || !key) return;
    const params = new URLSearchParams();
    if (opts.display) params.set("display", opts.display);
    else params.set("channels", key);
    if (opts.presence) params.set("presence", opts.presence);
    if (lastId.current) params.set("since", lastId.current);
    const replacement = connections.current++ > 0;
    const es = new EventSource(`/api/realtime?${params.toString()}`);
    let opened = false;
    es.onopen = () => {
      setState("open");
      // Reconnects, and replacement connections after a channel change, may
      // have missed events: refetch the server's state once.
      if (opened || replacement) resync.current?.();
      opened = true;
    };
    es.onerror = () => setState(navigator.onLine ? "reconnecting" : "offline");
    es.addEventListener("message", (m) => {
      if ((m as MessageEvent).lastEventId) lastId.current = (m as MessageEvent).lastEventId;
      try {
        handler.current(JSON.parse((m as MessageEvent).data));
      } catch {
        /* ignore malformed */
      }
    });
    es.addEventListener("ready", (m) => { if ((m as MessageEvent).lastEventId) lastId.current = (m as MessageEvent).lastEventId; });
    es.addEventListener("replayed", () => resync.current?.());
    const online = () => resync.current?.();
    window.addEventListener("online", online);
    return () => {
      es.close();
      window.removeEventListener("online", online);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opts.presence, enabled]);

  return state;
}

/** Fetch JSON with consistent error handling. */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "content-type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { message?: string }).message ?? "Something went wrong. Please try again.") as Error & { status: number; code?: string };
    err.status = res.status;
    err.code = (data as { error?: string }).error;
    throw err;
  }
  return data as T;
}
