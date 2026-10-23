"use client";

import { useEffect, useRef, useState } from "react";
import { HoverInfo } from "@/components/ui/hover-info";
import { useA11y, useReducedMotion } from "@/components/a11y-provider";
import { playSfx, type Sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { SpeechBubble } from "@/components/speech-bubble";
import { FlowerHead } from "@/components/flower";
import { flowerInfo, type FlowerId } from "@/lib/domain/flowers";

/**
 * The group's plant, in a small bubble pinned to the corner. It grows only
 * when the GROUP finishes a stage (spec §23: cooperative, never individual
 * or competitive): seed → sprout → leaves → bud → flower. A ring round the
 * bubble fills with progress. Hover for details; tap and the plant sways,
 * makes a little sound and says something (including how it's growing).
 */
type Tap = { say: string; anim: "plant-sway" | "plant-water" | "plant-grow"; sfx: Sfx };
export function PlantBubble({ stagesDone, totalStages, className, flower = null, size = "md" }: { stagesDone: number; totalStages: number; className?: string; flower?: FlowerId | null; size?: "sm" | "md" }) {
  const reduced = useReducedMotion();
  const progress = totalStages ? Math.min(1, stagesDone / totalStages) : 0;
  const { prefs } = useA11y();
  const [sway, setSway] = useState(0);
  const [said, setSaid] = useState<(Tap & { key: number }) | null>(null);
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null);
  const sayT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (sayT.current) clearTimeout(sayT.current); }, []);
  const [grew, setGrew] = useState(false);
  const last = useRef(stagesDone);
  useEffect(() => {
    if (stagesDone > last.current) {
      // The group just finished a stage: a little "grow" pop.
      setGrew(true);
      const t = setTimeout(() => setGrew(false), 1200);
      last.current = stagesDone;
      return () => clearTimeout(t);
    }
    last.current = stagesDone;
  }, [stagesDone]);

  const R = 33;
  const C = 2 * Math.PI * R;
  const stageName = progress >= 1 ? "in full bloom" : progress >= 0.6 ? "budding" : progress >= 0.3 ? "growing leaves" : progress > 0 ? "sprouting" : "a seed";
  const fname = flower ? flowerInfo(flower).name : null;
  const status = progress >= 1 && fname ? `I bloomed into a ${fname}! It's in your garden now.` : progress >= 1 ? "I'm in full bloom! Amazing teamwork!" : progress >= 0.6 ? "I've got a bud! Nearly there…" : progress >= 0.3 ? "New leaves! Teamwork helps me grow." : progress > 0 ? "Look — I'm sprouting!" : "I'm a tiny seed. Finish a stage together and I'll sprout!";
  const lines: Tap[] = [
    { say: status, anim: "plant-sway", sfx: "plant" },
    { say: "Ahh, thanks for the water!", anim: "plant-water", sfx: "water" },
    { say: `${stagesDone} of ${totalStages} stages done!`, anim: "plant-grow", sfx: "grow" },
    { say: "Hehe, the breeze tickles!", anim: "plant-sway", sfx: "plant" },
    { say: progress >= 1 ? (fname ? `${fname} petals — aren't they lovely?` : "Look at my petals!") : "Grow, grow, grow…", anim: "plant-grow", sfx: "grow" },
  ];
  function tap(e: React.MouseEvent) {
    // Taps talk; the details card is for hover (the bubble says the same).
    e.preventDefault();
    const line = lines[sway % lines.length];
    setSway((n) => n + 1);
    setSaid({ ...line, key: Date.now() });
    if (prefs.sound) playSfx(line.sfx);
    if (sayT.current) clearTimeout(sayT.current);
    sayT.current = setTimeout(() => setSaid(null), 2400);
  }
  const anim = grew ? "plant-grow" : said ? said.anim : "plant-idle";
  return (
    <HoverInfo suppress={!!said} side="top" align="start" content={
      <div className="flex flex-col gap-1">
        <p className="font-display text-base font-semibold">{fname ? `Your group's plant bloomed into a ${fname}!` : <>Your group&apos;s plant is {stageName}</>}</p>
        <p className="text-ink-muted">{stagesDone} of {totalStages} stages done. It grows each time your group finishes a stage together{fname ? "" : ", and opens into a flower for your garden at the end"}.</p>
      </div>
    }>
      <button
        ref={setBtn}
        type="button"
        onClick={tap}
        className={cn("group relative flex shrink-0 items-center justify-center rounded-full bg-white shadow-lift ring-2 ring-white transition-transform hover:-translate-y-0.5", size === "sm" ? "size-12" : "size-[4.75rem]", className)}
        data-testid="plant-bubble"
        data-tour="plant"
      >
        <svg viewBox="0 0 76 76" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="38" cy="38" r={R} fill="none" stroke="var(--mint-soft)" strokeWidth="5" />
          <circle cx="38" cy="38" r={R} fill="none" stroke="#2fbf71" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: "stroke-dashoffset 800ms ease" }} />
        </svg>
        <span key={`${sway}-${grew}`} className={cn("block", !reduced && anim)}>
          <Plant progress={progress} size={size === "sm" ? 32 : 52} flower={flower} />
        </span>
        {said?.anim === "plant-water" && !reduced ? <span key={`d${said.key}`} className="plant-drop pointer-events-none absolute left-1/2 top-0 h-3 w-2 rounded-full rounded-t-[60%] bg-[#4cb8ff]" aria-hidden="true" /> : null}
        {said ? <SpeechBubble anchor={btn} text={said.say} id={said.key} /> : null}
        <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1.5 py-0.5 text-[0.7rem] font-bold tabular-nums text-white">{stagesDone}/{totalStages}</span>
        <span className="sr-only"> stages done — your group&apos;s plant, more details</span>
      </button>
    </HoverInfo>
  );
}

/** A potted plant drawn for a given progress (0–1). */
export function Plant({ progress, size = 56, flower = null }: { progress: number; size?: number; flower?: FlowerId | null }) {
  const stem = progress <= 0 ? 0 : 8 + progress * 30;
  const top = 58 - stem;
  const leaves = Math.min(6, Math.floor(progress * 7));
  const bud = progress >= 0.6 && progress < 1;
  const bloom = progress >= 1;
  return (
    <svg viewBox="0 0 64 80" width={size} height={size * 1.25} aria-hidden="true" className="overflow-visible">
      {/* pot */}
      <path d="M17 58h30l-4 18H21z" fill="#e8743b" />
      <rect x="14" y="54" width="36" height="7" rx="3" fill="#f08a52" />
      <ellipse cx="32" cy="55" rx="15" ry="2.5" fill="#6b3f2a" />
      {progress <= 0 ? <ellipse cx="32" cy="53" rx="4" ry="3" fill="#a0673f" /> : null}
      {stem > 0 ? (
        <g className="plant-stem">
          <path d={`M32 55 C 30 ${55 - stem / 2}, 34 ${55 - stem / 2}, 32 ${top}`} stroke="#2f9e44" strokeWidth="3" fill="none" strokeLinecap="round" />
          {Array.from({ length: leaves }).map((_, i) => {
            const y = 52 - i * (stem / Math.max(leaves, 1)) * 0.85;
            const left = i % 2 === 0;
            return <path key={i} d={left ? `M32 ${y}c-6-1-11-5-12-10 6 0 11 4 12 10z` : `M32 ${y}c6-1 11-5 12-10-6 0-11 4-12 10z`} fill={i % 2 ? "#3fca6e" : "#86e05f"} />;
          })}
          {progress > 0 && leaves === 0 ? <path d={`M32 ${top}c-4-3-8-3-9 0 3 2 6 2 9 0zM32 ${top}c4-4 8-4 9-1-3 2-6 3-9 1z`} fill="#86e05f" /> : null}
          {bud ? <ellipse cx="32" cy={top - 3} rx="4.5" ry="6" fill="#ff8fc2" /> : null}
          {bloom && flower ? (
            <g transform={`translate(32 ${top - 5}) scale(0.8)`}><FlowerHead id={flower} /></g>
          ) : bloom ? (
            <g transform={`translate(32 ${top - 4})`}>
              {[0, 60, 120, 180, 240, 300].map((r) => <ellipse key={r} cx="0" cy="-7" rx="4.5" ry="7" fill="#ff7fb0" transform={`rotate(${r})`} />)}
              <circle r="4.5" fill="#ffc83d" />
            </g>
          ) : null}
        </g>
      ) : null}
    </svg>
  );
}
