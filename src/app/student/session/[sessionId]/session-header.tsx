"use client";

import { CircleHelp, Hand, LifeBuoy, Lock, LogOut, Star } from "lucide-react";
import { Pip } from "@/components/mascot";
import type { StudentState } from "@/lib/modules/sessions/state";
import type { ConnectionState } from "@/lib/realtime/client";
import { HoverInfo } from "@/components/ui/hover-info";
import { BigTimer } from "@/components/live/big-timer";
import { ConnectionStatus } from "@/components/live/connection-status";
import { AccessibilitySettingsButton } from "@/components/accessibility-settings";
import { useRun } from "@/components/ui/toast";
import { signOutAction } from "@/app/(auth)/sign-in/actions";
import { cn } from "@/lib/utils";
import { HelpPanel } from "./help-panel";
import type { StudentAction } from "./context";

/** Just three things matter at a glance: what stage it is, how long is left, and my role. */
export function SessionHeader({ state, connection, sessionId, act, onAskPip, onTour }: {
  state: StudentState; connection: ConnectionState; sessionId: string; act: (b: StudentAction) => Promise<unknown>; onAskPip?: () => void; onTour?: () => void;
}) {
  const g = state.group;
  const run = useRun();
  const live = state.session.status === "active" || state.session.status === "paused";
  const me = g?.members.find((m) => m.id === state.me.id);
  const inStage = g && live && g.stageStatus !== "complete" && g.stage;
  return (
    <header className="relative z-20 border-b-2 border-white/80 bg-white/80 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">
        {/* Where we are */}
        <div className="min-w-0 flex-1 basis-40">
          {inStage ? (
            <>
              <p className="truncate text-sm font-semibold text-ink-muted">Group {g.name} · Stage {g.stageIndex + 1} of {state.session.stages.length}</p>
              <p className="truncate font-display text-2xl font-bold leading-tight">{g.stage!.title}</p>
            </>
          ) : (
            <p className="truncate font-display text-xl font-bold">{g && live && g.stageStatus === "complete" ? "All done!" : state.session.title}</p>
          )}
        </div>

        {/* How long is left */}
        <div className="flex shrink-0 justify-center">
          {inStage ? <BigTimer timer={g.timer} totalSeconds={g.stage!.durationSeconds} /> : null}
        </div>

        {/* Help, settings — and my role in the corner */}
        <div className="flex flex-1 shrink-0 items-center justify-end gap-2 whitespace-nowrap max-sm:basis-full max-sm:justify-between">
          {connection !== "open" ? <ConnectionStatus state={connection} /> : null}
          {g && live && onAskPip ? (
            <button type="button" onClick={onAskPip} className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-purple-soft pl-1 pr-3.5 font-semibold text-purple-strong hover:brightness-95">
              <Pip size={36} animate={false} mood="happy" /><span className="max-lg:sr-only">Ask Pip</span><Lock className="size-4" aria-hidden="true" /><span className="sr-only">(private)</span>
            </button>
          ) : null}
          <span className="flex items-center gap-2" data-tour="help">
          {g && live ? (
            <button
              type="button"
              aria-pressed={!!me?.handRaised}
              onClick={() => run(() => act({ action: "hand" }))}
              className={cn("inline-flex h-11 items-center gap-1.5 rounded-2xl px-3.5 font-semibold transition-colors", me?.handRaised ? "bg-sun text-ink shadow-soft" : "bg-surface-2 text-ink hover:bg-sun-soft")}
            >
              <Hand className="size-5" aria-hidden="true" /><span className="max-xl:sr-only">{me?.handRaised ? "Hand up" : "Raise hand"}</span>
            </button>
          ) : null}
          <HelpPanel state={state} sessionId={sessionId} act={act} trigger={
            <button type="button" className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-coral px-3.5 font-semibold text-white shadow-soft hover:brightness-95">
              <LifeBuoy className="size-5" aria-hidden="true" /><span className="sm:hidden">Help</span><span className="max-sm:hidden">Need help</span>
            </button>
          } />
          </span>
          {g && live && onTour ? (
            <button type="button" onClick={onTour} className="inline-flex size-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-2" aria-label="How this screen works (tour)"><CircleHelp className="size-5" aria-hidden="true" /></button>
          ) : null}
          <AccessibilitySettingsButton showStudentOptions compact />
          <form action={signOutAction}>
            <button type="submit" className="inline-flex size-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-2" aria-label="Sign out"><LogOut className="size-4" aria-hidden="true" /></button>
          </form>
          {g && state.session.roles.length ? <MyRole state={state} /> : null}
        </div>
      </div>
    </header>
  );
}

/** The student's own role(s), prominent in the corner. */
function MyRole({ state }: { state: StudentState }) {
  const g = state.group!;
  const mine = g.members.find((m) => m.id === state.me.id)?.roles ?? [];
  const roles = mine.map((k) => state.session.roles.find((r) => r.key === k)).filter((r): r is NonNullable<typeof r> => !!r);
  const choosing = g.stage?.kind === "role_selection" && g.stageStatus !== "complete";
  const label = roles.length ? roles.map((r) => r.name).join(" & ") : choosing ? "Choose below" : "No role";
  return (
    <HoverInfo
      align="end"
      content={roles.length ? (
        <div className="flex flex-col gap-2">
          {roles.map((r) => <div key={r.key}><p className="font-display text-base font-semibold">{r.name}</p><p className="text-ink-muted">{r.description}</p></div>)}
          <p className="text-xs text-ink-muted">Your role guides how you help. Everyone can still join in with everything.</p>
        </div>
      ) : <p>{choosing ? "Pick a role for this lesson — or none, if you'd rather join in your own way." : "You don't have a role — join in however suits you."}</p>}
    >
      <button type="button" className={cn("flex items-center gap-2 rounded-2xl py-1.5 pl-2.5 pr-4 text-left", roles.length ? "bg-sun text-ink shadow-soft" : "bg-surface-2 text-ink-muted")} data-testid="my-role" data-tour="my-role">
        <Star className={cn("size-6", roles.length && "fill-white")} aria-hidden="true" />
        <span className="flex flex-col leading-tight">
          <span className="text-[0.7rem] font-bold uppercase tracking-wide">Your role</span>
          <span className="max-w-40 truncate font-display text-lg font-bold">{label}</span>
        </span>
        <span className="sr-only">— more about it</span>
      </button>
    </HoverInfo>
  );
}
