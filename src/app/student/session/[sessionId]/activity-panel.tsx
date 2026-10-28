"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { STAGE_ICONS } from "@/components/stage-icon";
import { useA11y } from "@/components/a11y-provider";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";
import { StagePanel } from "./stage-panel";
import { IdeaBank } from "./idea-bank";
import { StageMedia } from "@/components/live/stage-media";

/**
 * The group's task: what to do, then the activity itself (Bloom sits beside
 * it, or in a slim bar on top on phones). The group's earlier ideas are
 * one tab away; "I'm ready" lives in the dock at the bottom.
 */
export function ActivityPanel({ className, compact = false, top, ideasBeside = false, headerAction }: { className?: string; compact?: boolean; top?: React.ReactNode; ideasBeside?: boolean; headerAction?: React.ReactNode }) {
  const { group, state, ideasSignal } = useWorkspace();
  const { prefs } = useA11y();
  const stage = group.stage;
  const kind = group.stageStatus === "complete" ? "complete" : stage?.kind;
  // Where the ideas ARE the activity, there's no separate Ideas tab.
  // (On big screens the ideas sit beside the activity instead.)
  const ideasTab = !ideasBeside && hasIdeasTab(kind);
  const [tab, setTab] = useState<"activity" | "ideas">("activity");
  // "See my ideas" elsewhere on screen switches this panel to the Ideas tab.
  const [seenSignal, setSeenSignal] = useState(ideasSignal);
  if (ideasSignal !== seenSignal) {
    setSeenSignal(ideasSignal);
    setTab("ideas");
  }
  const showIdeas = ideasTab && tab === "ideas";
  const Icon = stage ? STAGE_ICONS[stage.kind].icon : Lightbulb;
  const ideaCount = kind === "brainstorm" ? group.ideas.mine.length : group.ideas.shared.length;

  return (
    <section
      aria-label="Your task"
      data-tour="activity"
      id="task-card"
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-[1.75rem] border-2 border-white bg-white/95 shadow-soft", className)}
    >
      {stage && kind !== "complete" ? top : null}
      {stage && kind !== "complete" ? (
        <div className={cn("border-b border-line px-3 sm:px-4", compact ? "py-2" : "pb-3 pt-2.5")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex size-7 items-center justify-center rounded-lg", STAGE_ICONS[stage.kind].tone)} aria-hidden="true"><Icon className="size-4" /></span>
            <p className="text-xs font-bold uppercase tracking-wide text-purple sm:text-sm">Your task<span className="max-sm:hidden"> · stage {group.stageIndex + 1} of {state.session.stages.length}</span></p>
            {ideasTab ? (
              <div role="tablist" aria-label="Activity or ideas" className="ml-auto flex gap-1 rounded-xl bg-surface-2 p-0.5 sm:p-1">
                <button type="button" role="tab" aria-selected={!showIdeas} onClick={() => setTab("activity")} className={cn("rounded-lg px-3 py-1 text-sm font-semibold", !showIdeas ? "bg-white shadow-soft" : "text-ink-muted hover:text-ink")}>Activity</button>
                <button type="button" role="tab" data-tour="ideas-tab" aria-selected={showIdeas} onClick={() => setTab("ideas")} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-semibold", showIdeas ? "bg-white shadow-soft" : "text-ink-muted hover:text-ink")}>
                  <Lightbulb className="size-4" aria-hidden="true" />Ideas<span className="rounded-full bg-sun px-1.5 text-xs">{ideaCount}</span>
                </button>
              </div>
            ) : null}
            {headerAction ? <div className="ml-auto">{headerAction}</div> : null}
          </div>
          {stage.instructions ? <TaskText text={stage.instructions} simplified={prefs.simplifiedInstructions} /> : null}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        {/* The activity stays mounted (hidden) while Ideas is open, so "Add" can reach the editor. */}
        {showIdeas ? <IdeaBank /> : null}
        <div className={cn("flex min-h-0 flex-1 flex-col", showIdeas && "hidden")}>
          {stage && kind !== "complete" && stage.config.attachments?.length ? <StageMedia items={stage.config.attachments} className="mb-3" /> : null}
          <StagePanel />
        </div>
      </div>
    </section>
  );
}

function TaskText({ text, simplified }: { text: string; simplified: boolean }) {
  // (No regex lookbehind: older iPads can't run it.)
  const sentences = (text.match(/[^.?!]+[.?!]*/g) ?? [text]).map((x) => x.trim()).filter(Boolean);
  const [all, setAll] = useState(!simplified || sentences.length <= 1);
  // On phones, long instructions start folded to two lines so the activity has room.
  const [open, setOpen] = useState(false);
  const long = text.length > 90;
  return (
    <div className="mt-1.5">
      <p className={cn("whitespace-pre-line font-display text-lg font-semibold leading-snug sm:text-xl", long && !open && "max-sm:line-clamp-2")}>{all ? text : sentences[0]}</p>
      {long ? <button type="button" className="mt-0.5 text-sm font-semibold text-teal underline-offset-4 hover:underline sm:hidden" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Show less" : "Show all"}</button> : null}
      {!all ? <button type="button" className="mt-1 text-sm font-semibold text-teal underline-offset-4 hover:underline" onClick={() => setAll(true)}>Show full instructions</button> : null}
    </div>
  );
}

/**
 * The group's ideas sit beside the task only while the group is making its
 * output (document, slides, whiteboard), where "Add" drops an idea into the
 * work. Elsewhere they'd just be clutter: thinking time lists your own ideas
 * under the box, and clustering, discussion and voting show the ideas as the
 * activity itself.
 */
export function hasIdeasTab(kind: string | undefined) {
  return kind === "creation";
}
