"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * What Nova, Pip or the plant "says" when tapped. Drawn in a portal at the
 * top layer so a scrolling panel or a card edge can never clip it; it sits
 * above-right of the character, or below when there's no room above.
 */
export function SpeechBubble({ anchor, text, id }: { anchor: HTMLElement | null; text: string; id: number }) {
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const below = r.top < 64;
    const left = Math.max(8, Math.min(r.left + r.width * 0.6, window.innerWidth - 232));
    // Measured from the anchor at the moment of the tap.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos({ left, top: below ? r.bottom + 6 : r.top + r.height * 0.1, below });
  }, [anchor, id]);
  if (!pos || typeof document === "undefined") return null;
  return createPortal(
    <span key={id} role="status" className="pointer-events-none fixed z-[80]" style={{ left: pos.left, top: pos.top, transform: pos.below ? undefined : "translateY(-100%)" }}>
      <span className={`bubble-in block w-max max-w-[14rem] rounded-2xl border-2 border-line bg-white px-2.5 py-1 font-display text-sm font-semibold text-ink shadow-lift ${pos.below ? "rounded-tl-sm" : "rounded-bl-sm"}`}>
        {text}
      </span>
    </span>,
    document.body,
  );
}
