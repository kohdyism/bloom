"use client";

import { CircleHelp, Hand, LifeBuoy, LogOut, MoreHorizontal, Star } from "lucide-react";
import { Popover } from "radix-ui";
import { useMediaQuery } from "@/lib/use-media-query";
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
export function SessionHeader({ state, connection, sessionId, act, onTour }: {
  state: StudentState; connection: ConnectionState; sessionId: string; act: (b: StudentAction) => Promise<unknown>; onTour?: () => void;
}) {
  const small = !useMediaQuery("(min-width: 640px)");
  const g = state.group;
  const run = useRun();
  const live = state.session.status === "active" || state.session.status === "paused";
  const me = g?.members.find((m) => m.id === state.me.id);
  const inStage = g && live && g.stageStatus !== "complete" && g.stage;
  if (small) {
    // Phones: one slim row so the lesson keeps the screen. Everything else is in "More".
    const mine = me?.roles ?? [];
    const roleNames = mine.map((k) => state.session.roles.find((r) => r.key === k)?.name).filter(Boolean);
    return (
      <header className="relative z-20 border-b-2 border-white/80 bg-white/85 backdrop-blur-md">
        <div className="flex items-center gap-2 px-2.5 py-1.5">
          <div className="min-w-0 flex-1">
            {inStage ? (
              <>
                <p className="truncate text-[0.7rem] font-semibold text-ink-muted">Stage {g.stageIndex + 1} of {state.session.stages.length}{roleNames.length ? ` · ${roleNames.join(" & ")}` : ""}</p>
                <p className="truncate font-display text-lg font-bold leading-tight">{g.stage!.title}</p>
              </>
            ) : <p className="truncate font-display text-lg font-bold">{g && live && g.stageStatus === "complete" ? "All done!" : state.session.title}</p>}
          </div>
          {connection !== "open" ? <ConnectionStatus state={connection} /> : null}
          {inStage ? <BigTimer timer={g.timer} totalSeconds={g.stage!.durationSeconds} compact /> : null}
          <span data-tour="help" className="flex items-center">
            <HelpPanel state={state} sessionId={sessionId} act={act} trigger={
              <button type="button" className="inline-flex h-10 items-center gap-1 rounded-2xl bg-coral px-2.5 font-semibold text-white shadow-soft"><LifeBuoy className="size-5" aria-hidden="true" />Help</button>
            } />
          </span>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button type="button" className="relative inline-flex size-10 items-center justify-center rounded-xl bg-surface-2 text-ink" aria-label="More options">
                <MoreHorizontal className="size-5" aria-hidden="true" />
                {me?.handRaised ? <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-sun" aria-label="Your hand is up" /> : null}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={6} collisionPadding={10} className="animate-pop z-50 flex w-64 flex-col gap-1 rounded-2xl border border-line bg-white p-2 shadow-lift">
                {g && live ? (
                  <button type="button" aria-pressed={!!me?.handRaised} onClick={() => run(() => act({ action: "hand" }))} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-semibold", me?.handRaised ? "bg-sun" : "hover:bg-surface-2")}>
                    <Hand className="size-5" aria-hidden="true" />{me?.handRaised ? "Lower my hand" : "Raise hand"}
                  </button>
                ) : null}
                {g && state.session.roles.length ? <p className="flex items-center gap-2.5 px-3 py-2 text-sm" data-tour="my-role"><Star className="size-5 shrink-0" aria-hidden="true" />Your role: <strong>{roleNames.length ? roleNames.join(" & ") : "none"}</strong></p> : null}
                {g && live && onTour ? <button type="button" onClick={onTour} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-semibold hover:bg-surface-2"><CircleHelp className="size-5" aria-hidden="true" />How this screen works</button> : null}
                <div className="flex items-center gap-1 border-t border-line pt-1">
                  <AccessibilitySettingsButton showStudentOptions />
                  <form action={signOutAction} className="ml-auto">
                    <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-muted hover:bg-surface-2"><LogOut className="size-4" aria-hidden="true" />Sign out</button>
                  </form>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </header>
    );
  }
  return (
    <header className="relative z-20 border-b-2 border-white/80 bg-white/80 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:px-4 sm:py-2.5">
        {/* Where we are */}
        <div className="min-w-0 flex-1 basis-40">
          {inStage ? (
            <>
              <p className="truncate text-xs font-semibold text-ink-muted sm:text-sm">Group {g.name} · Stage {g.stageIndex + 1} of {state.session.stages.length}</p>
              <p className="truncate font-display text-xl font-bold leading-tight sm:text-2xl">{g.stage!.title}</p>
            </>
          ) : (
            <p className="truncate font-display text-xl font-bold">{g && live && g.stageStatus === "complete" ? "All done!" : state.session.title}</p>
          )}
        </div>

        {/* How long is left */}
        <div className="flex shrink-0 justify-center">
          {inStage ? <BigTimer timer={g.timer} totalSeconds={g.stage!.durationSeconds} compact={small} /> : null}
        </div>

        {/* Help, settings — and my role in the corner */}
        <div className="flex flex-1 shrink-0 items-center justify-end gap-1.5 whitespace-nowrap max-sm:basis-full max-sm:justify-between sm:gap-2">
          {connection !== "open" ? <ConnectionStatus state={connection} /> : null}
          <span className="flex items-center gap-2" data-tour="help">
          {g && live ? (
            <button
              type="button"
              aria-pressed={!!me?.handRaised}
              onClick={() => run(() => act({ action: "hand" }))}
              className={cn("inline-flex h-10 items-center gap-1.5 rounded-2xl px-3 font-semibold transition-colors sm:h-11 sm:px-3.5", me?.handRaised ? "bg-sun text-ink shadow-soft" : "bg-surface-2 text-ink hover:bg-sun-soft")}
            >
              <Hand className="size-5" aria-hidden="true" /><span className="max-xl:sr-only">{me?.handRaised ? "Hand up" : "Raise hand"}</span>
            </button>
          ) : null}
          <HelpPanel state={state} sessionId={sessionId} act={act} trigger={
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-coral px-3 font-semibold text-white shadow-soft hover:brightness-95 sm:h-11 sm:px-3.5">
              <LifeBuoy className="size-5" aria-hidden="true" /><span className="sm:hidden">Help</span><span className="max-sm:hidden">Need help</span>
            </button>
          } />
          </span>
          {g && live && onTour ? (
            <button type="button" onClick={onTour} className="inline-flex size-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-2" aria-label="How this screen works (tour)"><CircleHelp className="size-5" aria-hidden="true" /></button>
          ) : null}
          <AccessibilitySettingsButton showStudentOptions compact />
          <form action={signOutAction} className="max-sm:hidden">
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
      <button type="button" className={cn("flex items-center gap-1.5 rounded-2xl py-1 pl-2 pr-3 text-left sm:gap-2 sm:py-1.5 sm:pl-2.5 sm:pr-4", roles.length ? "bg-sun text-ink shadow-soft" : "bg-surface-2 text-ink-muted")} data-testid="my-role" data-tour="my-role">
        <Star className={cn("size-5 sm:size-6", roles.length && "fill-white")} aria-hidden="true" />
        <span className="flex flex-col leading-tight">
          <span className="text-[0.7rem] font-bold uppercase tracking-wide max-sm:sr-only">Your role</span>
          <span className="max-w-28 truncate font-display text-base font-bold sm:max-w-40 sm:text-lg">{label}</span>
        </span>
        <span className="sr-only">— more about it</span>
      </button>
    </HoverInfo>
  );
}
