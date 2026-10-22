"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/a11y-provider";
import { cn } from "@/lib/utils";
import { Mascot, type MascotMood } from "./mascot";

type Reaction = { anim: "sprout-hop" | "sprout-wiggle" | "sprout-spin" | null; mood: MascotMood; say: string; zzz?: boolean };

const REACTIONS: Reaction[] = [
  { anim: "sprout-hop", mood: "happy", say: "Hi there!" },
  { anim: "sprout-wiggle", mood: "happy", say: "Hehe — that tickles!" },
  { anim: null, mood: "sleepy", say: "zzz…", zzz: true },
  { anim: "sprout-spin", mood: "surprised", say: "Wheee!" },
  { anim: "sprout-hop", mood: "celebrate", say: "You've got this!" },
  { anim: "sprout-wiggle", mood: "wave", say: "I'm growing with your group." },
];

const DOZE_AFTER_MS = 90_000;

/**
 * Interactive Sprout. Click (or Enter/Space) for a little reaction: a hop,
 * a wiggle, a spin, or a quick nap with a "zzz" bubble. If nobody touches the
 * page for a while Sprout dozes off; any click wakes it. With reduced motion
 * Sprout still reacts — with speech bubbles instead of movement.
 */
export function SproutBuddy({ size = 96, mood = "idle", className, bubbleSide = "right", label = "Sprout, Bloom's helper" }: {
  size?: number; mood?: MascotMood; className?: string; bubbleSide?: "right" | "left" | "top"; label?: string;
}) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [active, setActive] = useState<(Reaction & { key: number }) | null>(null);
  const [dozing, setDozing] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Doze after a long quiet spell; any activity on the page resets the clock.
  useEffect(() => {
    let t = setTimeout(() => setDozing(true), DOZE_AFTER_MS);
    const reset = () => {
      clearTimeout(t);
      t = setTimeout(() => setDozing(true), DOZE_AFTER_MS);
    };
    const events = ["pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current); }, []);

  const poke = useCallback(() => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    let r: Reaction;
    if (dozing) {
      setDozing(false);
      r = { anim: "sprout-hop", mood: "surprised", say: "Oh! I'm awake!" };
    } else {
      r = REACTIONS[i % REACTIONS.length];
      setI((n) => n + 1);
    }
    setActive({ ...r, key: Date.now() });
    clearTimer.current = setTimeout(() => setActive(null), r.zzz ? 3200 : 2200);
  }, [dozing, i]);

  const showZzz = (dozing && !active) || active?.zzz;
  const faceMood: MascotMood = active ? active.mood : dozing ? "sleepy" : mood;
  const say = active?.say ?? (dozing ? "zzz…" : null);
  const bubblePos =
    bubbleSide === "left" ? "right-[85%] top-0" : bubbleSide === "top" ? "bottom-[95%] left-1/2 -translate-x-1/2" : "left-[85%] top-0";

  return (
    <button
      type="button"
      onClick={poke}
      className={cn("group relative inline-flex shrink-0 cursor-pointer select-none items-end justify-center rounded-full outline-offset-4", className)}
      aria-label={`${label}. Press to say hi.`}
      style={{ width: size, height: size }}
    >
      <span key={active?.key ?? "idle"} className={cn("block transition-transform group-hover:-translate-y-0.5", !reduced && active?.anim)}>
        <Mascot mood={faceMood} size={size} animate={!dozing} />
      </span>
      {showZzz && !reduced ? (
        <span className="pointer-events-none absolute right-[8%] top-[4%] font-display font-bold text-purple" aria-hidden="true">
          <span className="zzz absolute text-sm" style={{ animationDelay: "0s" }}>z</span>
          <span className="zzz absolute text-base" style={{ animationDelay: "0.8s" }}>z</span>
          <span className="zzz absolute text-lg" style={{ animationDelay: "1.6s" }}>Z</span>
        </span>
      ) : null}
      {active && !active.zzz && !reduced ? (
        <span className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="sparkle absolute left-[6%] top-[18%] size-2.5 rotate-45 rounded-sm bg-sun" />
          <span className="sparkle absolute right-[4%] top-[30%] size-2 rounded-full bg-[#ff6fa3]" style={{ animationDelay: "120ms" }} />
          <span className="sparkle absolute left-[18%] top-[2%] size-1.5 rounded-full bg-purple" style={{ animationDelay: "220ms" }} />
        </span>
      ) : null}
      {say ? (
        <span
          key={`b${active?.key ?? "doze"}`}
          className={cn(
            "bubble-in pointer-events-none absolute z-10 whitespace-nowrap rounded-2xl border-2 border-purple/25 bg-surface px-3 py-1.5 font-display text-sm font-semibold text-ink shadow-lift",
            bubblePos,
          )}
          aria-live="polite"
        >
          {say}
        </span>
      ) : null}
    </button>
  );
}
