"use client";

import Link from "next/link";
import { Check, Hand, LifeBuoy, LogOut, Star } from "lucide-react";
import type { StudentState } from "@/lib/modules/sessions/state";
import type { ConnectionState } from "@/lib/realtime/client";
import { STAGE_ICONS } from "@/components/stage-icon";
import { Avatar } from "@/components/ui/primitives";
import { HoverInfo } from "@/components/ui/hover-info";
import { Mascot } from "@/components/mascot";
import { BigTimer } from "@/components/live/big-timer";
import { ConnectionStatus } from "@/components/live/connection-status";
import { GroupProgress } from "@/components/live/group-progress";
import { AccessibilitySettingsButton } from "@/components/accessibility-settings";
import { useRun } from "@/components/ui/toast";
import { signOutAction } from "@/app/(auth)/sign-in/actions";
import { cn, minutesLabel } from "@/lib/utils";
import { HelpPanel } from "./help-panel";
import { roleName, type StudentAction } from "./context";

export function SessionHeader({ state, connection, sessionId, act }: {
  state: StudentState; connection: ConnectionState; sessionId: string; act: (b: StudentAction) => Promise<unknown>;
}) {
  const g = state.group;
  const run = useRun();
  const live = state.session.status === "active" || state.session.status === "paused";
  const me = g?.members.find((m) => m.id === state.me.id);
  const showTimer = g && live && g.stageStatus !== "complete";
  return (
    <header className="relative z-20 border-b border-white/70 bg-white/75 shadow-soft backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
        <Link href="/student" className="flex shrink-0 items-center gap-1.5 rounded-xl" aria-label="Bloom — back to my lessons">
          <Mascot size={34} animate={false} />
          <span className="hidden font-display text-lg font-bold lg:inline">Bloom</span>
        </Link>

        {g ? <GroupPill state={state} /> : <p className="min-w-0 truncate font-semibold">{state.session.title}</p>}

        {g && live ? <StageJourney state={state} /> : <div className="flex-1" />}

        <div className="flex items-center gap-2">
          {showTimer ? <BigTimer timer={g.timer} totalSeconds={g.stage?.durationSeconds} /> : null}
          <ConnectionStatus state={connection} className="hidden md:inline-flex" />
          {g && live ? (
            <button
              type="button"
              aria-pressed={!!me?.handRaised}
              onClick={() => run(() => act({ action: "hand" }))}
              className={cn("inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors", me?.handRaised ? "bg-sun text-ink shadow-soft" : "bg-white/80 text-ink hover:bg-sun-soft")}
            >
              <Hand className="size-4" aria-hidden="true" />{me?.handRaised ? "Hand up" : "Raise hand"}
            </button>
          ) : null}
          <HelpPanel state={state} sessionId={sessionId} act={act} trigger={
            <button type="button" className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-coral px-3 text-sm font-semibold text-white shadow-soft hover:brightness-95">
              <LifeBuoy className="size-4" aria-hidden="true" />Need help
            </button>
          } />
          <AccessibilitySettingsButton showStudentOptions compact />
          <form action={signOutAction}>
            <button type="submit" className="inline-flex size-10 items-center justify-center rounded-xl text-ink-muted hover:bg-white" aria-label="Sign out"><LogOut className="size-4" aria-hidden="true" /></button>
          </form>
        </div>

        {g && state.session.roles.length ? <MyRole state={state} /> : null}
      </div>
    </header>
  );
}

function GroupPill({ state }: { state: StudentState }) {
  const g = state.group!;
  return (
    <HoverInfo
      align="start"
      content={
        <div className="flex flex-col gap-2">
          <p className="font-display text-base font-semibold">Group {g.name}</p>
          <ul className="flex flex-col gap-1.5">
            {g.members.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <Avatar name={m.name} color={m.avatarColor} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{m.id === state.me.id ? `${m.name} (you)` : m.name}</span>
                  {m.roles.length ? <span className="block text-xs text-ink-muted">{m.roles.map((r) => roleName(state, r)).join(", ")}</span> : null}
                </span>
                {m.handRaised ? <Hand className="size-4 text-amber" aria-label="Hand raised" /> : null}
                <span className={cn("size-2.5 rounded-full", m.present ? "bg-mint" : "bg-line-strong")} aria-label={m.present ? "Online" : "Away"} />
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <button type="button" className="flex min-w-0 items-center gap-2 rounded-2xl bg-white/80 py-1 pl-1 pr-3 shadow-soft hover:bg-white" aria-label={`Group ${g.name}: ${g.members.map((m) => m.name).join(", ")}. Show group details.`}>
        <span className="flex -space-x-2">
          {g.members.map((m) => (
            <span key={m.id} className="relative">
              <Avatar name={m.name} color={m.avatarColor} size="sm" className={cn(!m.present && "opacity-45")} />
              {m.handRaised ? <Hand className="absolute -right-1 -top-1.5 size-3.5 rounded-full bg-sun p-0.5 text-ink" aria-hidden="true" /> : null}
            </span>
          ))}
        </span>
        <span className="truncate font-display text-base font-bold">{g.name}</span>
      </button>
    </HoverInfo>
  );
}

/** The lesson as a path of stage icons; details on hover/tap. */
function StageJourney({ state }: { state: StudentState }) {
  const g = state.group!;
  const stages = state.session.stages;
  const doneAll = g.stageStatus === "complete";
  const total = stages.length;
  const done = doneAll ? total : g.stageIndex;
  const current = stages[g.stageIndex];
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
      <nav aria-label={doneAll ? `All ${total} stages complete` : `Stage ${g.stageIndex + 1} of ${total}: ${current?.title}`} className="min-w-0">
        <ol className="flex items-center">
          {stages.map((st, i) => {
            const { icon: Icon } = STAGE_ICONS[st.kind];
            const isDone = doneAll || i < g.stageIndex;
            const isNow = !doneAll && i === g.stageIndex;
            return (
              <li key={i} className="flex items-center">
                {i > 0 ? <span className={cn("h-1 w-3 rounded-full sm:w-5", isDone || isNow ? "bg-teal" : "bg-line-strong/70")} aria-hidden="true" /> : null}
                <HoverInfo content={<div><p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Stage {i + 1} of {total}</p><p className="font-display text-base font-semibold">{st.title}</p><p className="text-ink-muted">{minutesLabel(st.durationSeconds)} · {isDone ? "done" : isNow ? "happening now" : "coming up"}</p></div>}>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className={cn(
                      "flex items-center justify-center rounded-full transition-all",
                      isNow ? "h-10 gap-1.5 bg-teal px-3 text-white shadow-lift ring-4 ring-teal/20" : isDone ? "size-8 bg-teal-soft text-teal-strong" : "size-8 border-2 border-dashed border-line-strong bg-white/70 text-ink-faint",
                    )}
                  >
                    {isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
                    {isNow ? <span className="hidden max-w-40 truncate text-sm font-semibold xl:inline">{st.title}</span> : null}
                  </button>
                </HoverInfo>
              </li>
            );
          })}
        </ol>
      </nav>
      {state.session.theme !== "none" ? (
        <HoverInfo content={<div><p className="font-semibold">{done} of {total} stages complete</p><p className="text-ink-muted">{state.session.theme === "garden" ? "Your group's plant grows with every stage you finish together." : state.session.theme === "constellation" ? "Every finished stage lights another star." : "Every finished stage moves your group along the path."}</p></div>}>
          <button type="button" className="hidden shrink-0 items-center gap-1 rounded-2xl bg-white/80 px-1.5 py-0.5 shadow-soft hover:bg-white lg:flex" aria-label={`Team progress: ${done} of ${total} stages complete. More details.`}>
            <GroupProgress theme={state.session.theme} progress={g.progress} stagesDone={done} totalStages={total} size={40} />
            <span className="pr-1 text-xs font-bold tabular-nums text-ink-muted">{done}/{total}</span>
          </button>
        </HoverInfo>
      ) : null}
    </div>
  );
}

/** The student's own role(s), prominent in the corner. Others' roles live in the group hover card. */
function MyRole({ state }: { state: StudentState }) {
  const g = state.group!;
  const mine = g.members.find((m) => m.id === state.me.id)?.roles ?? [];
  const roles = mine.map((k) => state.session.roles.find((r) => r.key === k)).filter((r): r is NonNullable<typeof r> => !!r);
  const label = roles.length ? roles.map((r) => r.name).join(" & ") : g.stage?.kind === "role_selection" ? "Pick one below" : "No role yet";
  return (
    <HoverInfo
      align="end"
      content={roles.length ? (
        <div className="flex flex-col gap-2">
          {roles.map((r) => <div key={r.key}><p className="font-display text-base font-semibold">{r.name}</p><p className="text-ink-muted">{r.description}</p></div>)}
          <p className="text-xs text-ink-muted">Roles guide how you help — everyone can still join in with everything.</p>
        </div>
      ) : <p>{g.stage?.kind === "role_selection" ? "Choose a role for this lesson — or none, if you'd rather join in your own way." : "You haven't got a role. That's fine — join in however suits you."}</p>}
    >
      <button type="button" className={cn("ml-auto flex items-center gap-2 rounded-2xl py-1.5 pl-2 pr-3.5 text-left shadow-soft", roles.length ? "bg-sun text-ink" : "bg-white/80 text-ink-muted")} data-testid="my-role" aria-label={`Your role: ${label}. More details.`}>
        <Star className={cn("size-5", roles.length ? "fill-white text-ink" : "")} aria-hidden="true" />
        <span className="flex flex-col leading-tight">
          <span className="text-[0.7rem] font-bold uppercase tracking-wide opacity-80">Your role</span>
          <span className="max-w-44 truncate font-display text-base font-bold">{label}</span>
        </span>
      </button>
    </HoverInfo>
  );
}
