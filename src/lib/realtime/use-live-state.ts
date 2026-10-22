"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, useRealtime, type ClientEvent, type ConnectionState } from "./client";

/**
 * Server-authoritative live state: fetch a projection, then refetch (debounced)
 * whenever a realtime hint arrives on one of our channels, and after every
 * reconnection. Realtime messages are never treated as the source of truth.
 */
export function useLiveState<T>(opts: {
  url: string | null;
  channels?: string[];
  display?: string;
  presence?: string;
  onEvent?: (e: ClientEvent) => boolean | void;
  initial?: T | null;
}): { data: T | null; error: string | null; connection: ConnectionState; refresh: () => void; loading: boolean } {
  const [data, setData] = useState<T | null>(opts.initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!opts.initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);
  const again = useRef(false);
  const urlRef = useRef(opts.url);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    urlRef.current = opts.url;
  });

  const load = useCallback(async () => {
    const url = urlRef.current;
    if (!url) return;
    if (inflight.current) {
      again.current = true;
      return;
    }
    inflight.current = true;
    try {
      const next = await api<T>(url, { cache: "no-store" });
      setData(next);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inflight.current = false;
      setLoading(false);
      if (again.current) {
        again.current = false;
        void loadRef.current();
      }
    }
  }, []);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), 120);
  }, [load]);

  useEffect(() => {
    if (opts.url) void load();
  }, [opts.url, load]);

  // Safety net: refresh periodically in case a hint was missed entirely.
  useEffect(() => {
    if (!opts.url) return;
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [opts.url, load]);

  const connection = useRealtime(
    { channels: opts.channels, display: opts.display, presence: opts.presence, enabled: !!opts.url },
    (e) => {
      const handled = opts.onEvent?.(e);
      if (handled !== true) refresh();
    },
    refresh,
  );

  return { data, error, connection, refresh, loading };
}
