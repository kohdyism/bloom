"use client";

import { useSecondClock } from "@/lib/use-now";
import { Clock, Pause } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";

type Timer = { remainingSeconds: number | null; deadline: string | null; paused: boolean; warning?: boolean; overdue?: boolean };

/**
 * Live countdown. Time running out is communicated in text as well as colour,
 * and is only announced to screen readers at the warning and at zero (not
 * every second).
 */
export function Countdown({ timer, warnSeconds = 60, size = "md", className }: { timer: Timer; warnSeconds?: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const now = useSecondClock();
  // Until hydrated (now === null) show the server-computed value.
  const remaining = timer.paused || !timer.deadline || now === null ? timer.remainingSeconds : Math.round((new Date(timer.deadline).getTime() - now) / 1000);
  if (remaining === null || remaining === undefined) return null;
  const overdue = remaining <= 0;
  const warning = !overdue && remaining <= warnSeconds;
  const label = timer.paused ? `Paused with ${formatDuration(remaining)} left` : overdue ? "Time's up — finish what you're doing" : `${formatDuration(remaining)} left`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold tabular-nums",
        size === "sm" ? "px-2 py-0.5 text-xs" : size === "lg" ? "px-4 py-1.5 text-2xl" : "px-3 py-1 text-sm",
        timer.paused ? "bg-surface-2 text-ink-muted" : overdue ? "bg-coral-soft text-coral" : warning ? "bg-amber-soft text-amber" : "bg-teal-soft text-teal-strong",
        className,
      )}
    >
      {timer.paused ? <Pause className="size-[1em]" aria-hidden="true" /> : <Clock className="size-[1em]" aria-hidden="true" />}
      <span aria-hidden="true">{timer.paused ? `Paused · ${formatDuration(remaining)}` : overdue ? "Time's up" : formatDuration(remaining)}</span>
      <span className="sr-only">{label}</span>
      <span className="sr-only" aria-live="polite">{overdue ? "Time is up for this stage. Your work is saved." : warning && remaining > warnSeconds - 2 ? "One minute left in this stage." : ""}</span>
    </span>
  );
}
