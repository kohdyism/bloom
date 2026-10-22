"use client";

import { Check, Clock3, Lightbulb, Lock, MessagesSquare, Undo2 } from "lucide-react";
import { Pip } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";
import type { PanelTab } from "./side-panel";

/**
 * Everything a student does besides the activity itself: open ideas or chat,
 * ask Pip privately, and say "I'm ready". Readiness shows how many are ready —
 * never who (spec §13).
 */
export function BottomBar({ panel, tabs, onToggle }: { panel: PanelTab | null; tabs: PanelTab[]; onToggle: (t: PanelTab) => void }) {
  const { group, openAssistant } = useWorkspace();
  const ideaCount = group.stage?.kind === "brainstorm" && group.stageStatus !== "complete" ? group.ideas.mine.length : group.ideas.shared.length;
  const chatCount = group.messages.filter((m) => m.kind !== "system").length;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t-2 border-white/80 bg-white/85 px-4 py-2.5 backdrop-blur-md">
      {tabs.includes("ideas") ? (
        <button type="button" aria-pressed={panel === "ideas"} onClick={() => onToggle("ideas")}
          className={cn("inline-flex h-12 items-center gap-2 rounded-2xl px-4 font-semibold transition", panel === "ideas" ? "bg-ink text-white" : "bg-sun text-ink hover:brightness-95")}>
          <Lightbulb className="size-5" aria-hidden="true" />Ideas<span className={cn("rounded-full px-2 text-sm", panel === "ideas" ? "bg-white/20" : "bg-white/70")}>{ideaCount}</span>
        </button>
      ) : null}
      {tabs.includes("chat") ? (
        <button type="button" aria-pressed={panel === "chat"} onClick={() => onToggle("chat")}
          className={cn("inline-flex h-12 items-center gap-2 rounded-2xl px-4 font-semibold transition", panel === "chat" ? "bg-ink text-white" : "bg-teal-soft text-teal-strong hover:brightness-95")}>
          <MessagesSquare className="size-5" aria-hidden="true" />Chat<span className={cn("rounded-full px-2 text-sm", panel === "chat" ? "bg-white/20" : "bg-white/70")}>{chatCount}</span>
        </button>
      ) : null}
      <button type="button" onClick={() => openAssistant()} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-purple-soft pl-1.5 pr-4 font-semibold text-purple-strong hover:brightness-95">
        <Pip size={38} animate={false} mood="happy" />Ask Pip <Lock className="size-4" aria-hidden="true" /><span className="sr-only">(private)</span>
      </button>
      <div className="ml-auto"><Readiness /></div>
    </div>
  );
}

function Readiness() {
  const { group, act } = useWorkspace();
  const run = useRun();
  const e = group.evaluation;
  if (!e || group.stageStatus === "complete") return null;
  const kind = group.stage?.kind;
  const teacherOnly = group.stage?.config.completion === "teacher_only";
  const mine = group.myReadiness;
  return (
    <div className="flex items-center gap-3">
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
