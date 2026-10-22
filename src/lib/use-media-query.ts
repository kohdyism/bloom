"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Live media-query match. Server render assumes `serverDefault` (desktop layout). */
export function useMediaQuery(query: string, serverDefault = true) {
  const subscribe = useCallback((cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => serverDefault);
}
