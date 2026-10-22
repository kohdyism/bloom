"use client";

import { Minimize2, Maximize2 } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { GroupProgress } from "@/components/live/group-progress";
import { useA11y } from "@/components/a11y-provider";
import { Badge } from "@/components/ui/primitives";
import { useWorkspace, roleName } from "./context";
import { Materials } from "./materials";

const THEME_TEXT: Record<string, string> = {
  garden: "Your group's plant grows with every stage you complete together.",
  constellation: "Each completed stage lights up another star.",
  journey: "Every stage you complete moves your group along the path.",
};

export function SidePanel() {
  const { state, group } = useWorkspace();
  const { prefs, update } = useA11y();
  const total = state.session.stages.length;
  const done = group.stageStatus === "complete" ? total : group.stageIndex;
  const theme = state.session.theme;
  const myRoles = group.members.find((m) => m.id === state.me.id)?.roles ?? [];
  return (
    <aside className="flex flex-col gap-4" aria-label="Group progress and materials">
      {theme !== "none" ? (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Team progress</h2>
            <button className="rounded-lg p-1 text-ink-muted hover:bg-surface-2" onClick={() => update({ gamification: prefs.gamification === "show" ? "minimised" : "show" })} aria-label={prefs.gamification === "show" ? "Minimise progress picture" : "Show progress picture"}>
              {prefs.gamification === "show" ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
          {prefs.gamification === "show" ? (
            <>
              <GroupProgress theme={theme} progress={group.progress} stagesDone={done} totalStages={total} size={140} className="my-2" />
              <p className="text-center text-xs text-ink-muted">{THEME_TEXT[theme]}</p>
            </>
          ) : null}
          <p className="mt-2 text-center text-sm font-semibold">{done} of {total} stages complete</p>
        </Card>
      ) : null}
      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Roles</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {group.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">{m.id === state.me.id ? "You" : m.name}</span>
              {m.roles.length ? m.roles.map((r) => <Badge key={r} tone="purple">{roleName(state, r)}</Badge>) : <span className="text-ink-muted">—</span>}
            </li>
          ))}
        </ul>
        {myRoles.length ? <p className="mt-2 text-xs text-ink-muted">Roles guide how you help — everyone can still contribute to everything.</p> : null}
      </Card>
      <Card className="p-4">
        {state.session.objectives.length ? (
          <>
            <h2 className="text-sm font-semibold">Today&apos;s goals</h2>
            <ul className="mb-3 mt-1 list-disc space-y-0.5 pl-5 text-sm">{state.session.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
          </>
        ) : null}
        <Materials materials={state.session.materials} />
      </Card>
    </aside>
  );
}
