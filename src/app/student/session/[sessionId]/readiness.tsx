"use client";

import { Check, Clock3, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";

type Evaluation = NonNullable<ReturnType<typeof useWorkspace>["group"]["evaluation"]>;

/** What the group is waiting for, in plain words (never who). */
function waitingText(e: Evaluation, teacherOnly: boolean, mine: string | null | undefined) {
  if (teacherOnly) return "Your teacher moves you on";
  if (!e.requirementsMet) return mine === "ready" ? `Still needed first: ${e.requirementLabel.toLowerCase()}` : e.requirementLabel;
  if (e.needTimeCount) return "Someone asked for more time";
  const left = e.activeCount - e.readyCount;
  if (mine === "ready" && left > 0) return `Waiting for ${left} more ${left === 1 ? "person" : "people"}`;
  return e.requirementLabel;
}

/** "I'm ready", in the dock at the bottom: how many are ready — never who (spec §13). */
export function Readiness({ className }: { className?: string }) {
  const { group, act } = useWorkspace();
  const run = useRun();
  const e = group.evaluation;
  if (!e || group.stageStatus === "complete") return null;
  const kind = group.stage?.kind;
  const teacherOnly = group.stage?.config.completion === "teacher_only";
  const mine = group.myReadiness;
  const readyLabel = kind === "brainstorm" ? "I'm done thinking" : kind === "talk" ? "We're done talking" : "I'm ready";
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3", className)} data-tour="ready">
      <div className="flex min-w-0 items-baseline gap-1.5 sm:flex-1 sm:flex-col sm:items-end sm:gap-0 sm:text-right">
        <p className="flex shrink-0 items-center gap-1.5 text-sm font-semibold sm:text-base" aria-live="polite">
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: e.activeCount }, (_, i) => <span key={i} className={cn("size-2.5 rounded-full border-2 sm:size-3", i < e.readyCount ? "border-mint bg-mint" : "border-line-strong bg-white")} />)}
          </span>
          {e.readyCount} of {e.activeCount} ready
        </p>
        <p className={cn("min-w-0 truncate text-xs sm:max-w-full", mine === "ready" && !e.requirementsMet ? "font-semibold text-amber" : "text-ink-muted")}><span className="sm:hidden" aria-hidden="true">· </span>{waitingText(e, teacherOnly, mine)}</p>
      </div>
      {mine ? (
        <span className="flex shrink-0 items-center gap-1 max-sm:justify-end">
          <span className={cn("inline-flex h-11 items-center gap-1.5 rounded-2xl px-3 font-semibold sm:px-4", mine === "ready" ? "bg-mint-soft text-mint" : "bg-amber-soft text-amber")}>
            {mine === "ready" ? <Check className="size-5" aria-hidden="true" /> : <Clock3 className="size-5" aria-hidden="true" />}
            <span className="max-sm:hidden">{mine === "ready" ? "You're ready" : "You asked for more time"}</span>
            <span className="sm:hidden">{mine === "ready" ? "Ready" : "More time"}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => run(() => act({ action: "readiness", state: null }))}><Undo2 />Undo</Button>
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 max-sm:justify-end">
          <Button variant="secondary" className="h-11 rounded-2xl px-3" onClick={() => run(() => act({ action: "readiness", state: "need_time" }))} aria-label="More time"><Clock3 /><span className="max-sm:hidden">More time</span></Button>
          <Button className="h-11 rounded-2xl px-4 text-base sm:px-6" onClick={() => run(() => act({ action: "readiness", state: "ready" }))}><Check />{readyLabel}</Button>
        </span>
      )}
    </div>
  );
}
