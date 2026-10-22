"use client";

import { useEffect, useRef, useState } from "react";
import { HoverInfo } from "@/components/ui/hover-info";
import { useReducedMotion } from "@/components/a11y-provider";
import { cn } from "@/lib/utils";

/**
 * The group's plant, in a small bubble pinned to the corner. It grows only
 * when the GROUP finishes a stage (spec §23: cooperative, never individual
 * or competitive): seed → sprout → leaves → bud → flower. A ring round the
 * bubble fills with progress. Tap or hover for details; tapping also makes
 * the plant sway.
 */
export function PlantBubble({ stagesDone, totalStages, className }: { stagesDone: number; totalStages: number; className?: string }) {
  const reduced = useReducedMotion();
  const progress = totalStages ? Math.min(1, stagesDone / totalStages) : 0;
  const [sway, setSway] = useState(0);
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
  return (
    <HoverInfo side="top" align="start" content={
      <div className="flex flex-col gap-1">
        <p className="font-display text-base font-semibold">Your group&apos;s plant is {stageName}</p>
        <p className="text-ink-muted">{stagesDone} of {totalStages} stages done. It grows each time your group finishes a stage together.</p>
      </div>
    }>
      <button
        type="button"
        onClick={() => setSway((n) => n + 1)}
        aria-label={`Your group's plant: ${stagesDone} of ${totalStages} stages done. More details.`}
        className={cn("group relative flex size-[4.75rem] items-center justify-center rounded-full bg-white shadow-lift ring-2 ring-white transition-transform hover:-translate-y-0.5", className)}
        data-testid="plant-bubble"
      >
        <svg viewBox="0 0 76 76" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="38" cy="38" r={R} fill="none" stroke="var(--mint-soft)" strokeWidth="5" />
          <circle cx="38" cy="38" r={R} fill="none" stroke="#2fbf71" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: "stroke-dashoffset 800ms ease" }} />
        </svg>
        <span key={`${sway}-${grew}`} className={cn("block", !reduced && (grew ? "plant-grow" : sway ? "plant-sway" : "plant-idle"))}>
          <Plant progress={progress} size={52} />
        </span>
        <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1.5 py-0.5 text-[0.7rem] font-bold tabular-nums text-white" aria-hidden="true">{stagesDone}/{totalStages}</span>
      </button>
    </HoverInfo>
  );
}

/** A potted plant drawn for a given progress (0–1). */
export function Plant({ progress, size = 56 }: { progress: number; size?: number }) {
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
          {bloom ? (
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
