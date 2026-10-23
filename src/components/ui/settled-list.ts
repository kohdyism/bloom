"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A ranked list that doesn't jump the moment a score changes. The list keeps
 * its order for a short beat (so you see the count change first), then
 * settles into the new ranking. New items join at the end straight away.
 */
export function useSettledOrder<T extends { id: string }>(items: T[], score: (item: T) => number, delayMs = 900): T[] {
  const ranked = items.map((item, i) => ({ item, i, s: score(item) })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.item.id);
  const key = ranked.join(",");
  const [order, setOrder] = useState<string[]>(ranked);
  useEffect(() => {
    const t = setTimeout(() => setOrder(key ? key.split(",") : []), delayMs);
    return () => clearTimeout(t);
  }, [key, delayMs]);
  const byId = new Map(items.map((x) => [x.id, x]));
  const shown = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  for (const x of items) if (!order.includes(x.id)) shown.push(x);
  return shown;
}

/**
 * Slides list items to their new places when the order changes (FLIP), so a
 * re-ranking reads as movement rather than a glitch. Items need data-flip-id.
 */
export function useFlip(listRef: React.RefObject<HTMLElement | null>, orderKey: string, disabled: boolean) {
  const last = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const next = new Map<string, { x: number; y: number }>();
    list.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
      const id = el.dataset.flipId!;
      const pos = { x: el.offsetLeft, y: el.offsetTop };
      next.set(id, pos);
      const prev = last.current.get(id);
      if (!prev || disabled || typeof el.animate !== "function") return;
      const dx = prev.x - pos.x;
      const dy = prev.y - pos.y;
      if (!dx && !dy) return;
      const rising = dy > 0;
      el.style.zIndex = rising ? "2" : "1";
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${rising ? 1.03 : 1})` },
          { transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(${rising ? 1.03 : 1})`, offset: 0.6 },
          { transform: "none" },
        ],
        { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" },
      ).onfinish = () => { el.style.zIndex = ""; };
    });
    last.current = next;
  }, [listRef, orderKey, disabled]);
}
