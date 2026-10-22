"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { STAGE_ICONS } from "@/components/stage-icon";
import { useA11y } from "@/components/a11y-provider";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";
import { StagePanel } from "./stage-panel";
import { IdeaBank } from "./idea-bank";
import { Readiness } from "./readiness";

/**
 * The stage activity, beside the group chat: the task on top, the activity
 * (or the group's earlier ideas, one tab away) in the middle, "I'm ready" at
 * the bottom.
 */
export function ActivityPanel({ className }: { className?: string }) {
  const { group, ideasSignal } = useWorkspace();
  const { prefs } = useA11y();
  const stage = group.stage;
  const kind = group.stageStatus === "complete" ? "complete" : stage?.kind;
  // Where the ideas ARE the activity, there's no separate Ideas tab.
  const ideasTab = kind !== "synthesis" && kind !== "voting" && kind !== "discussion" && kind !== "complete";
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
    <section aria-label="Activity" className={cn("flex min-h-0 flex-col overflow-hidden rounded-[1.75rem] border-2 border-white bg-white/90 shadow-soft", className)}>
      {stage && kind !== "complete" ? (
        <div className="border-b border-line px-4 pb-3 pt-3.5">
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex size-8 items-center justify-center rounded-xl", STAGE_ICONS[stage.kind].tone)} aria-hidden="true"><Icon className="size-4" /></span>
            <p className="text-sm font-bold uppercase tracking-wide text-purple">Your task</p>
            {ideasTab ? (
              <div role="tablist" aria-label="Activity or ideas" className="ml-auto flex gap-1 rounded-xl bg-surface-2 p-1">
                <button type="button" role="tab" aria-selected={!showIdeas} onClick={() => setTab("activity")} className={cn("rounded-lg px-3 py-1 text-sm font-semibold", !showIdeas ? "bg-white shadow-soft" : "text-ink-muted hover:text-ink")}>Activity</button>
                <button type="button" role="tab" aria-selected={showIdeas} onClick={() => setTab("ideas")} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-semibold", showIdeas ? "bg-white shadow-soft" : "text-ink-muted hover:text-ink")}>
                  <Lightbulb className="size-4" aria-hidden="true" />Ideas<span className="rounded-full bg-sun px-1.5 text-xs">{ideaCount}</span>
                </button>
              </div>
            ) : null}
          </div>
          {stage.instructions ? <TaskText text={stage.instructions} simplified={prefs.simplifiedInstructions} /> : null}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        {showIdeas ? <IdeaBank /> : <StagePanel />}
      </div>
      {kind !== "complete" ? (
        <div className="border-t border-line bg-white px-4 py-3"><Readiness /></div>
      ) : null}
    </section>
  );
}

function TaskText({ text, simplified }: { text: string; simplified: boolean }) {
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  const [all, setAll] = useState(!simplified || sentences.length <= 1);
  return (
    <div className="mt-1.5">
      <p className="whitespace-pre-line font-display text-xl font-semibold leading-snug">{all ? text : sentences[0]}</p>
      {!all ? <button type="button" className="mt-1 text-sm font-semibold text-teal underline-offset-4 hover:underline" onClick={() => setAll(true)}>Show full instructions</button> : null}
    </div>
  );
}
