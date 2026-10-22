"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { artifactBus } from "./artifact-bus";

export type SaveState = "loading" | "saved" | "saving" | "offline" | "error" | "readonly";

const toB64 = (u: Uint8Array) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Client side of the CRDT sync.
 *  - Loads the full persisted state from the server (and again after any
 *    reconnection), merging it into the local doc — never replacing it.
 *  - Batches local edits every 250 ms and POSTs them with an idempotency key,
 *    retrying with backoff. Unsent edits are mirrored to localStorage so a
 *    closed tab or dropped connection doesn't lose work; they are re-sent on
 *    the next load.
 *  - Applies remote updates delivered over the group's realtime channel.
 */
export function useYDoc(artifactId: string | null, opts: { readOnly?: boolean } = {}) {
  const [doc] = useState(() => new Y.Doc());
  const [status, setStatus] = useState<SaveState>("loading");
  const [loaded, setLoaded] = useState(false);
  const queue = useRef<Uint8Array[]>([]);
  const sending = useRef(false);
  const backoff = useRef(500);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readOnly = useRef(!!opts.readOnly);
  useEffect(() => {
    readOnly.current = !!opts.readOnly;
  });

  useEffect(() => {
    if (!artifactId) return;
    const key = `bloom.pending.${artifactId}`;
    let cancelled = false;

    const persistPending = () => {
      try {
        if (queue.current.length) localStorage.setItem(key, toB64(Y.mergeUpdates(queue.current)));
        else localStorage.removeItem(key);
      } catch { /* storage full or unavailable */ }
    };

    const flush = async () => {
      timer.current = null;
      if (sending.current || !queue.current.length || cancelled) return;
      sending.current = true;
      // Snapshot the batch: edits made while this request is in flight keep
      // accumulating in queue.current and are sent in the next batch.
      const batch = queue.current.slice();
      const merged = Y.mergeUpdates(batch);
      const clientUpdateId = uid();
      setStatus("saving");
      try {
        const res = await fetch(`/api/artifacts/${artifactId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ update: toB64(merged), clientUpdateId }),
        });
        if (res.status === 409) {
          // Lesson ended: keep the local copy, stop sending.
          setStatus("readonly");
          readOnly.current = true;
          sending.current = false;
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        queue.current = queue.current.slice(batch.length);
        backoff.current = 500;
        persistPending();
        setStatus(queue.current.length ? "saving" : "saved");
      } catch {
        setStatus(navigator.onLine ? "error" : "offline");
        backoff.current = Math.min(backoff.current * 2, 15_000);
        sending.current = false;
        timer.current = setTimeout(flush, backoff.current);
        return;
      }
      sending.current = false;
      if (queue.current.length) timer.current = setTimeout(flush, 50);
    };

    const schedule = () => {
      if (!timer.current) timer.current = setTimeout(flush, 250);
    };

    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === "remote" || origin === "server" || readOnly.current) return;
      queue.current.push(update);
      persistPending();
      setStatus("saving");
      schedule();
    };
    doc.on("update", onUpdate);

    const loadServer = async () => {
      try {
        const res = await fetch(`/api/artifacts/${artifactId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { update: string };
        if (cancelled) return;
        Y.applyUpdate(doc, fromB64(data.update), "server");
        setLoaded(true);
        setStatus((s) => (s === "loading" || s === "offline" || s === "error" ? (queue.current.length ? "saving" : "saved") : s));
        if (queue.current.length) schedule();
      } catch {
        if (!cancelled) setStatus(navigator.onLine ? "error" : "offline");
      }
    };

    // Re-apply edits that never reached the server last time.
    try {
      const pending = localStorage.getItem(key);
      if (pending) {
        const u = fromB64(pending);
        Y.applyUpdate(doc, u, "restore");
        queue.current.push(u);
      }
    } catch { /* ignore */ }

    void loadServer();
    const offBus = artifactBus.on((p) => {
      if (p.artifactId !== artifactId) return;
      if (p.update) Y.applyUpdate(doc, fromB64(p.update), "remote");
      else void loadServer();
    });
    const offResync = artifactBus.onResync(() => void loadServer());
    const online = () => { void loadServer(); schedule(); };
    window.addEventListener("online", online);
    const beforeUnload = (e: BeforeUnloadEvent) => { if (queue.current.length) e.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      cancelled = true;
      doc.off("update", onUpdate);
      offBus();
      offResync();
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
      if (timer.current) clearTimeout(timer.current);
      // Best effort: send what's left; it is also kept in localStorage.
      if (queue.current.length) {
        const body = JSON.stringify({ update: toB64(Y.mergeUpdates(queue.current)), clientUpdateId: uid() });
        void fetch(`/api/artifacts/${artifactId}`, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).then((r) => { if (r.ok) localStorage.removeItem(key); }).catch(() => {});
      }
    };
  }, [artifactId, doc]);

  return { doc, status, loaded };
}

export function SaveIndicator({ status }: { status: SaveState }) {
  const text = {
    loading: "Loading…",
    saved: "All changes saved",
    saving: "Saving…",
    offline: "Offline — changes kept on this device and will sync",
    error: "Couldn't save yet — retrying. Your changes are kept.",
    readonly: "The lesson has ended — read-only",
  }[status];
  const tone = status === "saved" ? "text-mint" : status === "error" || status === "offline" ? "text-coral" : "text-ink-muted";
  return <span className={`text-xs font-semibold ${tone}`} role="status" aria-live="polite">{text}</span>;
}
