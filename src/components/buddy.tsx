"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/a11y-provider";
import { cn } from "@/lib/utils";
import { Nova, Pip, type Mood } from "./mascot";

type Anim = "buddy-hop" | "buddy-wiggle" | "buddy-nod" | "buddy-cheer" | null;
type Reaction = { anim: Anim; mood: Mood; say?: string };
export type CueKind = "hop" | "wiggle" | "nod" | "cheer";
export type Cue = { kind: CueKind; say?: string; key: number };

const CUE: Record<CueKind, { anim: Anim; mood: Mood }> = {
  hop: { anim: "buddy-hop", mood: "happy" },
  wiggle: { anim: "buddy-wiggle", mood: "happy" },
  nod: { anim: "buddy-nod", mood: "happy" },
  cheer: { anim: "buddy-cheer", mood: "celebrate" },
};

const TAPS: Record<"nova" | "pip", Reaction[]> = {
  nova: [
    { anim: "buddy-hop", mood: "happy", say: "Hi team!" },
    { anim: "buddy-wiggle", mood: "happy", say: "Hehe!" },
    { anim: null, mood: "resting", say: "zzz…" },
    { anim: "buddy-cheer", mood: "celebrate", say: "You've got this!" },
  ],
  pip: [
    { anim: "buddy-hop", mood: "happy", say: "Hi!" },
    { anim: "buddy-wiggle", mood: "happy", say: "That tickles!" },
    { anim: null, mood: "resting", say: "zzz…" },
    { anim: "buddy-nod", mood: "happy", say: "I'm here if you need me." },
  ],
};

const REST_AFTER_MS = 90_000;

/**
 * Nova or Pip, alive on the page:
 *  - tap (or Enter/Space) for a little reaction — hop, wiggle, nap, cheer;
 *  - `cue` lets the page react to what the student does (a nod when a
 *    message is sent, a cheer when an idea is added);
 *  - `talking` moves the mouth while a reply is arriving; `listening` leans
 *    in while the student is typing;
 *  - after a long quiet spell they nod off; a tap wakes them.
 * With reduced motion they still change expression and speak, but don't move.
 */
export function Buddy({ who, size = 72, mood = "idle", className, name, cue, talking, listening }: {
  who: "nova" | "pip"; size?: number; mood?: Mood; className?: string; name?: string; cue?: Cue | null; talking?: boolean; listening?: boolean;
}) {
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

  const play = useCallback((r: Reaction, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    setResting(false);
    setActive({ ...r, key: Date.now() + Math.random() });
    timer.current = setTimeout(() => setActive(null), ms);
  }, []);

  // Reactions the page asks for.
  const lastCue = useRef<number | null>(null);
  useEffect(() => {
    if (!cue || cue.key === lastCue.current) return;
    lastCue.current = cue.key;
    play({ ...CUE[cue.kind], say: cue.say }, cue.say ? 1800 : 900);
  }, [cue, play]);

  const poke = useCallback(() => {
    const list = TAPS[who];
    if (resting) { play({ anim: "buddy-hop", mood: "happy", say: "Oh — I'm awake!" }, 1800); return; }
    const r = list[i % list.length];
    setI((n) => n + 1);
    play(r, r.mood === "resting" ? 3000 : 1800);
  }, [who, resting, i, play]);

  const C = who === "pip" ? Pip : Nova;
  const shown: Mood = active ? active.mood : resting ? "resting" : talking ? "talking" : listening ? "listening" : mood;
  const loop = !reduced && !active && !resting ? (talking ? "buddy-chatter" : listening ? "buddy-listen" : null) : null;
  const label = name ?? (who === "pip" ? "Pip" : "Nova");
  return (
    <button type="button" onClick={poke} className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full outline-offset-4", className)} style={{ width: size, height: size }} aria-label={`${label}. Press to say hi.`}>
      <span className={cn("block", loop)}>
        <span key={active?.key ?? "still"} className={cn("block", !reduced && active?.anim)}>
          <C mood={shown} size={size} animate={!resting} />
        </span>
      </span>
      {active?.say ? (
        <span key={`b${active.key}`} className="bubble-in pointer-events-none absolute bottom-[88%] left-[62%] z-10 whitespace-nowrap rounded-2xl rounded-bl-sm border-2 border-line bg-white px-2.5 py-1 font-display text-sm font-semibold text-ink shadow-lift" aria-live="polite">
          {active.say}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Small state helper for pages that drive a Buddy: `fire` a reaction,
 * `listen` while the student types (stops ~1.4 s after the last keystroke),
 * `talkFor` a few seconds when a reply arrives.
 */
export function useBuddy() {
  const [cue, setCue] = useState<Cue | null>(null);
  const [listening, setListening] = useState(false);
  const [talking, setTalking] = useState(false);
  const listenT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const talkT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (listenT.current) clearTimeout(listenT.current); if (talkT.current) clearTimeout(talkT.current); }, []);
  const fire = useCallback((kind: CueKind, say?: string) => setCue({ kind, say, key: Date.now() + Math.random() }), []);
  const listen = useCallback(() => {
    setListening(true);
    if (listenT.current) clearTimeout(listenT.current);
    listenT.current = setTimeout(() => setListening(false), 1400);
  }, []);
  const talkFor = useCallback((ms = 2400) => {
    setTalking(true);
    if (talkT.current) clearTimeout(talkT.current);
    talkT.current = setTimeout(() => setTalking(false), ms);
  }, []);
  return { cue, listening, talking, fire, listen, talkFor };
}
