"use client";

import { Check, Clock3, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";

/** "I'm ready": shows how many are ready — never who (spec §13). */
export function Readiness() {
  const { group, act } = useWorkspace();
  const run = useRun();
  const e = group.evaluation;
  if (!e || group.stageStatus === "complete") return null;
  const kind = group.stage?.kind;
  const teacherOnly = group.stage?.config.completion === "teacher_only";
  const mine = group.myReadiness;
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="hidden text-right sm:block">
        <p className="flex items-center justify-end gap-1.5 font-semibold" aria-live="polite">
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: e.activeCount }, (_, i) => <span key={i} className={cn("size-3 rounded-full border-2", i < e.readyCount ? "border-mint bg-mint" : "border-line-strong bg-white")} />)}
          </span>
          {e.readyCount} of {e.activeCount} ready
        </p>
        <p className="max-w-64 truncate text-xs text-ink-muted" title={teacherOnly ? "Your teacher will move your group on" : e.requirementLabel}>{teacherOnly ? "Your teacher moves you on" : e.needTimeCount ? "Someone asked for more time" : e.requirementLabel}</p>
      </div>
      {mine ? (
        <>
          <span className={cn("inline-flex h-12 items-center gap-1.5 rounded-2xl px-4 font-semibold", mine === "ready" ? "bg-mint-soft text-mint" : "bg-amber-soft text-amber")}>
            {mine === "ready" ? <Check className="size-5" aria-hidden="true" /> : <Clock3 className="size-5" aria-hidden="true" />}
            {mine === "ready" ? "You're ready" : "You asked for more time"}
          </span>
          <Button variant="ghost" onClick={() => run(() => act({ action: "readiness", state: null }))}><Undo2 />Undo</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" className="h-12 rounded-2xl" onClick={() => run(() => act({ action: "readiness", state: "need_time" }))}><Clock3 />More time</Button>
          <Button className="h-12 rounded-2xl px-6 text-base" onClick={() => run(() => act({ action: "readiness", state: "ready" }))}><Check />{kind === "brainstorm" ? "I'm done thinking" : "I'm ready"}</Button>
        </>
      )}
    </div>
  );
}
