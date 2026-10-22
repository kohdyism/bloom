"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/a11y-provider";
import { cn } from "@/lib/utils";
import { Nova, Pip, type Mood } from "./mascot";

type Reaction = { anim: "buddy-hop" | "buddy-wiggle" | null; mood: Mood; say: string };

const REACTIONS: Record<"nova" | "pip", Reaction[]> = {
  nova: [
    { anim: "buddy-hop", mood: "happy", say: "Hi team!" },
    { anim: "buddy-wiggle", mood: "happy", say: "Hehe!" },
    { anim: null, mood: "resting", say: "zzz…" },
    { anim: "buddy-hop", mood: "celebrate", say: "You've got this!" },
  ],
  pip: [
    { anim: "buddy-hop", mood: "happy", say: "Hi!" },
    { anim: "buddy-wiggle", mood: "happy", say: "That tickles!" },
    { anim: null, mood: "resting", say: "zzz…" },
  ],
};

const REST_AFTER_MS = 90_000;

/**
 * Tappable Nova or Pip. Each press gives a small reaction (a hop, a wiggle,
 * or a quick nap with "zzz"). After a long quiet spell they nod off; a press
 * wakes them. With reduced motion they react with words only.
 */
export function Buddy({ who, size = 72, mood = "idle", className, name }: { who: "nova" | "pip"; size?: number; mood?: Mood; className?: string; name?: string }) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [active, setActive] = useState<(Reaction & { key: number }) | null>(null);
  const [resting, setResting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let t = setTimeout(() => setResting(true), REST_AFTER_MS);
    const reset = () => { clearTimeout(t); t = setTimeout(() => setResting(true), REST_AFTER_MS); };
    window.addEventListener("pointerdown", reset, { passive: true });
    window.addEventListener("keydown", reset);
    return () => { clearTimeout(t); window.removeEventListener("pointerdown", reset); window.removeEventListener("keydown", reset); };
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const poke = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const list = REACTIONS[who];
    const r: Reaction = resting ? { anim: "buddy-hop", mood: "happy", say: "Oh — I'm awake!" } : list[i % list.length];
    if (!resting) setI((n) => n + 1);
    setResting(false);
    setActive({ ...r, key: Date.now() });
    timer.current = setTimeout(() => setActive(null), r.mood === "resting" ? 3000 : 1800);
  }, [who, resting, i]);

  const C = who === "pip" ? Pip : Nova;
  const shown: Mood = active ? active.mood : resting ? "resting" : mood;
  const label = name ?? (who === "pip" ? "Pip" : "Nova");
  return (
    <button type="button" onClick={poke} className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full outline-offset-4", className)} style={{ width: size, height: size }} aria-label={`${label}. Press to say hi.`}>
      <span key={active?.key ?? "still"} className={cn("block", !reduced && active?.anim)}>
        <C mood={shown} size={size} animate={!resting} />
      </span>
      {active ? (
        <span key={`b${active.key}`} className="bubble-in pointer-events-none absolute bottom-[88%] left-[62%] z-10 whitespace-nowrap rounded-2xl rounded-bl-sm border-2 border-line bg-white px-2.5 py-1 font-display text-sm font-semibold text-ink shadow-lift" aria-live="polite">
          {active.say}
        </span>
      ) : null}
    </button>
  );
}
