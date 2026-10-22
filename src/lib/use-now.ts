"use client";

import { useSyncExternalStore } from "react";

/**
 * Shared ticking clocks so render code never calls Date.now() directly.
 * During server rendering and hydration they return null, letting callers
 * fall back to server-computed values (no hydration mismatches).
 */
type Clock = { subscribe: (cb: () => void) => () => void; get: () => number; server: () => null };
const clocks = new Map<number, Clock>();

/** Module-level store per interval (kept outside React so render stays pure). */
function clock(ms: number): Clock {
  const existing = clocks.get(ms);
  if (existing) return existing;
  const state = { now: typeof window === "undefined" ? 0 : Date.now(), listeners: new Set<() => void>(), timer: null as ReturnType<typeof setInterval> | null };
  const c: Clock = {
    subscribe(cb) {
      state.listeners.add(cb);
      if (!state.timer) {
        state.now = Date.now();
        state.timer = setInterval(() => {
          state.now = Date.now();
          state.listeners.forEach((l) => l());
        }, ms);
      }
      return () => {
        state.listeners.delete(cb);
        if (!state.listeners.size && state.timer) {
          clearInterval(state.timer);
          state.timer = null;
        }
      };
    },
    get: () => state.now,
    server: () => null,
  };
  clocks.set(ms, c);
  return c;
}

function useClock(ms: number): number | null {
  const c = clock(ms);
  return useSyncExternalStore(c.subscribe, c.get, c.server);
}

/** Coarse clock (15 s) for "is this recent?" checks. */
export function useNow(): number {
  return useClock(15_000) ?? 0;
}

/** One-second clock for countdowns; null until hydrated. */
export function useSecondClock(): number | null {
  return useClock(1000);
}
