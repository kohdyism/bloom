"use client";

import { useState } from "react";
import { CircleHelp, Clock3, Hand, LifeBuoy, LogOut, MoreHorizontal, Settings2, Star } from "lucide-react";
import { Popover } from "radix-ui";
import { useMediaQuery } from "@/lib/use-media-query";
import type { StudentState } from "@/lib/modules/sessions/state";
import type { ConnectionState } from "@/lib/realtime/client";
import { HoverInfo } from "@/components/ui/hover-info";
import { BigTimer } from "@/components/live/big-timer";
import { ConnectionStatus } from "@/components/live/connection-status";
import { AccessibilitySettingsDialog } from "@/components/accessibility-settings";
import { useRun } from "@/components/ui/toast";
import { signOutAction } from "@/app/(auth)/sign-in/actions";
import { cn } from "@/lib/utils";
import { HelpPanel } from "./help-panel";
import type { StudentAction } from "./context";

/**
 * Kept to the essentials so the task stays the focus: where we are, how long
 * is left, "Need help" — and everything else tucked into one "More" menu.
 * The role chip only shows when the student actually has a role.
 */
export function SessionHeader({ state, connection, sessionId, act, onTour }: {
  state: StudentState; connection: ConnectionState; sessionId: string; act: (b: StudentAction) => Promise<unknown>; onTour?: () => void;
}) {
  const small = !useMediaQuery("(min-width: 640px)");
  const g = state.group;
  const live = state.session.status === "active" || state.session.status === "paused";
  const me = g?.members.find((m) => m.id === state.me.id);
  const inStage = g && live && g.stageStatus !== "complete" && g.stage;
  const hasRole = !!(g && state.session.roles.length && me?.roles?.length);
  return (
    <header className="relative z-20 border-b-2 border-white/80 bg-white/85 backdrop-blur-md">
      <div className="flex items-center gap-2 px-2.5 py-1 sm:gap-3 sm:px-4 sm:py-1.5">
        <div className="min-w-0 flex-1">
          {inStage ? (
            <>
              <p className="truncate text-[0.7rem] font-semibold text-ink-muted sm:text-sm">Stage {g.stageIndex + 1} of {state.session.stages.length}</p>
              <p className="truncate font-display text-lg font-bold leading-tight sm:text-xl">{g.stage!.title}</p>
            </>
          ) : <p className="truncate font-display text-lg font-bold sm:text-xl">{g && live && g.stageStatus === "complete" ? "All done!" : state.session.title}</p>}
        </div>
        {inStage ? <div className="flex shrink-0 justify-center sm:flex-1"><BigTimer timer={g.timer} totalSeconds={g.stage!.durationSeconds} compact={small} /></div> : null}
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:flex-1 sm:gap-2">
          {connection !== "open" ? <ConnectionStatus state={connection} /> : null}
          {hasRole ? <MyRole state={state} /> : null}
          <span data-tour="help" className="flex items-center gap-1.5 sm:gap-2">
            <HelpPanel state={state} sessionId={sessionId} act={act} trigger={
              <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-coral px-3 font-semibold text-white shadow-soft hover:brightness-95 sm:px-3.5">
                <LifeBuoy className="size-5" aria-hidden="true" /><span className="sm:hidden">Help</span><span className="max-sm:hidden">Need help</span>
              </button>
            } />
            <MoreMenu state={state} act={act} onTour={onTour} />
          </span>
        </div>
      </div>
    </header>
  );
}

/** Raise hand, more time, the tour, settings and sign out — one tap away, out of the way. */
export function MoreMenu({ state, act, onTour, className }: {
  state: StudentState; act: (b: StudentAction) => Promise<unknown>; onTour?: () => void; className?: string;
}) {
  const run = useRun();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const g = state.group;
  const live = state.session.status === "active" || state.session.status === "paused";
  const me = g?.members.find((m) => m.id === state.me.id);
  const kind = g?.stage?.kind;
  // "More time" only while the group is deciding whether to move on.
  const canAskTime = !!(g && live && g.evaluation && g.stageStatus !== "complete" && kind !== "presentation" && !g.myReadiness);
  const item = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-semibold hover:bg-surface-2";
  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" className={cn("relative inline-flex h-10 items-center gap-1.5 rounded-2xl bg-surface-2 px-2.5 font-semibold text-ink hover:bg-line sm:px-3", className)} aria-label="More">
            <MoreHorizontal className="size-5" aria-hidden="true" /><span className="max-sm:hidden">More</span>
            {me?.handRaised ? <span className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full border-2 border-white bg-sun" aria-label="Your hand is up" /> : null}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={6} collisionPadding={10} className="animate-pop z-50 flex w-64 flex-col gap-0.5 rounded-2xl border border-line bg-white p-2 shadow-lift">
            {g && live ? (
              <button type="button" aria-pressed={!!me?.handRaised} onClick={() => { setOpen(false); run(() => act({ action: "hand" })); }} className={cn(item, me?.handRaised && "bg-sun hover:bg-sun")}>
                <Hand className="size-5" aria-hidden="true" />{me?.handRaised ? "Lower my hand" : "Raise hand"}
              </button>
            ) : null}
            {canAskTime ? (
              <button type="button" onClick={() => { setOpen(false); run(() => act({ action: "readiness", state: "need_time", stageIndex: g!.stageIndex })); }} className={item}>
                <Clock3 className="size-5" aria-hidden="true" />I need more time
              </button>
            ) : null}
            {g && live && onTour ? <button type="button" onClick={() => { setOpen(false); onTour(); }} className={item}><CircleHelp className="size-5" aria-hidden="true" />How this screen works</button> : null}
            <button type="button" onClick={() => { setOpen(false); setSettings(true); }} className={item}><Settings2 className="size-5" aria-hidden="true" />Settings</button>
            <form action={signOutAction} className="border-t border-line pt-0.5">
              <button type="submit" className={cn(item, "text-ink-muted")}><LogOut className="size-5" aria-hidden="true" />Sign out</button>
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <AccessibilitySettingsDialog open={settings} onOpenChange={setSettings} showStudentOptions />
    </>
  );
}

/** The student's own role(s), prominent in the corner. */
function MyRole({ state }: { state: StudentState }) {
  const g = state.group!;
  const mine = g.members.find((m) => m.id === state.me.id)?.roles ?? [];
  const roles = mine.map((k) => state.session.roles.find((r) => r.key === k)).filter((r): r is NonNullable<typeof r> => !!r);
  const label = roles.map((r) => r.name).join(" & ");
  return (
    <HoverInfo
      align="end"
      content={
        <div className="flex flex-col gap-2">
          {roles.map((r) => <div key={r.key}><p className="font-display text-base font-semibold">{r.name}</p><p className="text-ink-muted">{r.description}</p></div>)}
          <p className="text-xs text-ink-muted">Your role guides how you help. Everyone can still join in with everything.</p>
        </div>
      }
    >
      <button type="button" className="flex items-center gap-1.5 rounded-2xl bg-sun py-1 pl-2 pr-3 text-left text-ink shadow-soft sm:gap-2 sm:pl-2.5 sm:pr-4" data-testid="my-role" data-tour="my-role">
        <Star className="size-5 fill-white sm:size-6" aria-hidden="true" />
        <span className="flex flex-col leading-tight">
          <span className="text-[0.7rem] font-bold uppercase tracking-wide max-sm:sr-only">Your role</span>
          <span className="max-w-28 truncate font-display text-base font-bold sm:max-w-40">{label}</span>
        </span>
        <span className="sr-only">— more about it</span>
      </button>
    </HoverInfo>
  );
}
