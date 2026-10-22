"use client";

import { Pause } from "lucide-react";
import { useSecondClock } from "@/lib/use-now";
import { HoverInfo } from "@/components/ui/hover-info";
import { cn, formatDuration, minutesLabel } from "@/lib/utils";

type Timer = { remainingSeconds: number | null; deadline: string | null; paused: boolean };

/**
 * The stage clock, big enough to read from across the table. A ring empties
 * as time runs down; colour AND words change near the end (never colour
 * alone). Screen readers hear it only at one minute left and at zero.
 */
export function BigTimer({ timer, totalSeconds, className }: { timer: Timer; totalSeconds?: number | null; className?: string }) {
  const now = useSecondClock();
  const remaining = timer.paused || !timer.deadline || now === null ? timer.remainingSeconds : Math.round((new Date(timer.deadline).getTime() - now) / 1000);
  if (remaining === null || remaining === undefined) return null;
  const total = Math.max(totalSeconds ?? 0, remaining, 1);
  const overdue = remaining <= 0;
  const warning = !overdue && (remaining <= 60 || remaining / total <= 0.15);
  const frac = Math.max(0, Math.min(1, remaining / total));
  const R = 22;
  const C = 2 * Math.PI * R;
  const tone = timer.paused ? "text-ink-muted" : overdue ? "text-coral" : warning ? "text-amber" : "text-teal";
  const ring = timer.paused ? "var(--line-strong)" : overdue ? "var(--coral)" : warning ? "#f59f00" : "var(--teal)";
  const endsAt = timer.deadline && !timer.paused ? new Date(timer.deadline).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
  const words = timer.paused ? "Paused" : overdue ? "Time's up" : warning ? "Nearly time" : "Time left";
  return (
    <HoverInfo
      content={
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{timer.paused ? "The timer is paused" : overdue ? "Time is up for this stage" : `${formatDuration(remaining)} left in this stage`}</p>
          {totalSeconds ? <p className="text-ink-muted">This stage is {minutesLabel(totalSeconds)} long.</p> : null}
          {endsAt ? <p className="text-ink-muted">Ends at {endsAt}.</p> : null}
          {overdue ? <p className="text-ink-muted">Finish what you&apos;re doing — your work is saved. Your teacher decides when to move on.</p> : null}
        </div>
      }
    >
      <button
        type="button"
        className={cn(
          "flex items-center gap-2.5 rounded-2xl border-2 bg-surface py-1 pl-1 pr-4 shadow-soft",
          overdue ? "timer-urgent border-coral/60" : warning ? "border-[#f59f00]/60" : "border-white/70",
          className,
        )}
        data-testid="stage-timer"
      >
        <svg viewBox="0 0 52 52" className="size-12 -rotate-90" aria-hidden="true">
          <circle cx="26" cy="26" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
          <circle cx="26" cy="26" r={R} fill="none" stroke={ring} strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset 900ms linear" }} />
        </svg>
        <span className="flex flex-col items-start leading-none">
          <span className={cn("text-[0.7rem] font-bold uppercase tracking-wide", tone)}>{words}</span>
          <span className={cn("font-display text-[1.9rem] font-bold tabular-nums leading-tight", tone)} aria-hidden="true">
            {timer.paused ? <Pause className="mr-1 inline size-6 align-[-2px]" /> : null}
            {overdue ? "0:00" : formatDuration(remaining)}
          </span>
        </span>
        <span className="sr-only">{timer.paused ? `Timer paused with ${formatDuration(remaining)} left` : overdue ? "Time is up for this stage" : `${formatDuration(remaining)} left in this stage`}. More details.</span>
        <span className="sr-only" aria-live="polite">{overdue ? "Time is up for this stage. Your work is saved." : remaining <= 60 && remaining > 58 ? "One minute left in this stage." : ""}</span>
      </button>
    </HoverInfo>
  );
}
