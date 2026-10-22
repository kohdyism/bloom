"use client";

import { Hand, LifeBuoy, MessagesSquare, Sparkles } from "lucide-react";
import type { StudentState } from "@/lib/modules/sessions/state";
import type { ConnectionState } from "@/lib/realtime/client";
import { Button } from "@/components/ui/button";
import { Avatar, StepDots } from "@/components/ui/primitives";
import { Countdown } from "@/components/live/countdown";
import { ConnectionStatus } from "@/components/live/connection-status";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { HelpPanel } from "./help-panel";
import type { StudentAction } from "./context";

export function TopBar({ state, connection, sessionId, act, onAssistant, onChat }: {
  state: StudentState; connection: ConnectionState; sessionId: string; act: (b: StudentAction) => Promise<unknown>; onAssistant: () => void; onChat: () => void; assistantTick: number;
}) {
  const g = state.group;
  const run = useRun();
  const live = state.session.status === "active" || state.session.status === "paused";
  const me = g?.members.find((m) => m.id === state.me.id);
  const total = state.session.stages.length;
  const inDiscussion = g?.stage?.kind === "discussion";
  return (
    <div className="sticky top-14 z-20 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {g ? (
            <>
              <div className="flex -space-x-1.5" aria-label={`Group ${g.name}: ${g.members.map((m) => m.name).join(", ")}`} role="group">
                {g.members.map((m) => (
                  <span key={m.id} className="relative">
                    <Avatar name={m.name} color={m.avatarColor} size="sm" className={cn(!m.present && "opacity-45")} title={`${m.name}${m.present ? "" : " (away)"}${m.handRaised ? " — hand raised" : ""}`} />
                    {m.handRaised ? <Hand className="absolute -right-1 -top-1.5 size-3.5 rounded-full bg-amber-soft p-0.5 text-amber" aria-hidden="true" /> : null}
                  </span>
                ))}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{g.name}{g.stage && live ? <span className="font-normal text-ink-muted"> · {g.stageStatus === "complete" ? "All done" : g.stage.title}</span> : null}</p>
                {live && g.stageStatus !== "complete" ? <StepDots total={total} current={g.stageIndex} label={`Stage ${g.stageIndex + 1} of ${total}`} /> : null}
              </div>
            </>
          ) : <p className="truncate text-sm font-semibold">{state.session.title}</p>}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ConnectionStatus state={connection} />
          {g && live && g.stageStatus !== "complete" ? <Countdown timer={g.timer} /> : null}
          {g && live ? (
            <Button size="sm" variant={me?.handRaised ? "soft" : "ghost"} aria-pressed={!!me?.handRaised} onClick={() => run(() => act({ action: "hand" }))} title="Raise your hand in your group">
              <Hand />{me?.handRaised ? "Hand up" : "Raise hand"}
            </Button>
          ) : null}
          {g && !inDiscussion ? <Button size="sm" variant="ghost" onClick={onChat}><MessagesSquare />Group chat</Button> : null}
          {g ? <Button size="sm" variant="soft" onClick={onAssistant} className="bg-purple-soft text-purple"><Sparkles />Ask Sprout <span className="sr-only">(private)</span></Button> : null}
          <HelpPanel state={state} sessionId={sessionId} act={act} trigger={<Button size="sm" variant="secondary"><LifeBuoy />Need help</Button>} />
        </div>
      </div>
    </div>
  );
}
