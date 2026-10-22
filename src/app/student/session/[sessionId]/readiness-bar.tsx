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
    <div className={cn("sticky bottom-0 z-10 mt-auto flex flex-wrap items-center gap-3 rounded-3xl border-2 bg-white/95 p-3 shadow-lift backdrop-blur", group.stageStatus === "ready_check" ? "border-teal" : "border-white")}>
      <ReadyDots ready={e.readyCount} total={e.activeCount} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-display text-base font-semibold">{teacherOnly ? "Your teacher will move your group on" : group.stageStatus === "ready_check" ? "Ready to move on?" : e.requirementLabel}</p>
        <p className="text-ink-muted" aria-live="polite">{hint ?? (teacherOnly ? "You can still mark yourself ready so your teacher knows." : e.needTimeCount ? `${e.readyCount} of ${e.activeCount} ready · someone asked for more time` : `${e.readyCount} of ${e.activeCount} ready`)}</p>
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
          <Button variant="secondary" onClick={() => run(() => act({ action: "readiness", state: "need_time" }))}><Clock3 />More time</Button>
          <Button size="lg" onClick={() => run(() => act({ action: "readiness", state: "ready" }))}><Check />{readyLabel}</Button>
        </>
      )}
    </div>
  );
}

/** How many are ready, as filled dots — never who. */
function ReadyDots({ ready, total }: { ready: number; total: number }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("size-3.5 rounded-full border-2", i < ready ? "border-mint bg-mint" : "border-line-strong bg-white")} />
      ))}
    </span>
  );
}
