"use client";

import { Check, Clock3, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";

/**
 * Explicit readiness confirmation (spec §13). Shows the observable
 * requirement and readiness count — never who is or isn't ready.
 */
export function ReadinessBar({ readyLabel = "I'm ready", hint }: { readyLabel?: string; hint?: string }) {
  const { group, act } = useWorkspace();
  const run = useRun();
  const e = group.evaluation;
  if (!e || group.stageStatus === "complete") return null;
  const teacherOnly = group.stage?.config.completion === "teacher_only";
  const mine = group.myReadiness;
  return (
    <div className={cn("sticky bottom-3 z-10 mt-6 flex flex-wrap items-center gap-3 rounded-2xl border bg-surface p-3 shadow-lift", group.stageStatus === "ready_check" ? "border-teal" : "border-line")}>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{teacherOnly ? "Your teacher will move your group on" : group.stageStatus === "ready_check" ? "Ready to move on?" : e.requirementLabel}</p>
        <p className="text-ink-muted" aria-live="polite">{hint ?? (teacherOnly ? "You can still mark yourself ready so your teacher knows." : e.waitingOn)}</p>
      </div>
      {mine ? (
        <>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", mine === "ready" ? "bg-mint-soft text-mint" : "bg-amber-soft text-amber")}>
            {mine === "ready" ? <Check className="size-4" aria-hidden="true" /> : <Clock3 className="size-4" aria-hidden="true" />}
            {mine === "ready" ? "You're ready" : "You asked for more time"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => run(() => act({ action: "readiness", state: null }))}><Undo2 />Undo</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" size="sm" onClick={() => run(() => act({ action: "readiness", state: "need_time" }))}><Clock3 />More time</Button>
          <Button size="sm" onClick={() => run(() => act({ action: "readiness", state: "ready" }))}><Check />{readyLabel}</Button>
        </>
      )}
    </div>
  );
}
