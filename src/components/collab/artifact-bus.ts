"use client";

/**
 * In-page bus that routes realtime artifact updates (which arrive on the
 * group channel shared by the whole workspace) to the open editors.
 */
type Handler = (payload: { artifactId: string; updateId: number; from: string; update?: string }) => void;
const handlers = new Set<Handler>();
const resyncers = new Set<() => void>();

export const artifactBus = {
  on(h: Handler) {
    handlers.add(h);
    return () => void handlers.delete(h);
  },
  emit(p: Parameters<Handler>[0]) {
    handlers.forEach((h) => h(p));
  },
  onResync(fn: () => void) {
    resyncers.add(fn);
    return () => void resyncers.delete(fn);
  },
  resync() {
    resyncers.forEach((fn) => fn());
  },
};
