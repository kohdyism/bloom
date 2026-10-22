"use client";

import { useState } from "react";
import { Check, Compass, MessagesSquare, Trophy, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";
import { Buddy } from "@/components/buddy";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useWorkspace, roleName } from "./context";
import { Brainstorm } from "./stage-brainstorm";
import { Synthesis } from "./stage-synthesis";
import { Discussion } from "./chat";
import { Creation } from "./stage-creation";
import { Submission } from "./stage-submission";
import { PresentationViewer } from "./presentation";
import { MediaUploader } from "./media";

/** The activity for the current stage (the task and Nova sit above it). */
export function StagePanel() {
  const { group } = useWorkspace();
  if (group.stageStatus === "complete") return <AllDone />;
  const kind = group.stage?.kind;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {group.timer.paused ? <Notice tone="amber" title="Paused">Your teacher has paused things for a moment. Your work is saved.</Notice> : null}
      {kind === "orientation" ? <Orientation /> : null}
      {kind === "role_selection" ? <RoleSelection /> : null}
      {kind === "brainstorm" ? <Brainstorm /> : null}
      {kind === "synthesis" ? <Synthesis /> : null}
      {kind === "discussion" ? <Discussion /> : null}
      {kind === "voting" ? <Voting /> : null}
      {kind === "creation" ? <Creation /> : null}
      {kind === "physical" ? <Physical /> : null}
      {kind === "submission" ? <Submission /> : null}
      {kind === "presentation" ? <PresentationStage /> : null}
      {kind === "reflection" ? <GroupReflection /> : null}
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl border-2 border-white bg-white/90 p-4 shadow-soft sm:p-5", className)}>{children}</div>;
}

function Orientation() {
  const { state } = useWorkspace();
  return (
    <Panel className="flex items-center gap-4">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-soft text-blue" aria-hidden="true"><Compass className="size-6" /></span>
      <p className="text-[1.05rem]">Read the task together and check everyone knows what your group will make by the end. {state.session.modality === "mostly_in_person" ? "Most of today happens in the room — Bloom keeps track of the steps." : "You can talk in the room, use the group chat, or both."}</p>
    </Panel>
  );
}

function RoleSelection() {
  const { state, group, act } = useWorkspace();
  const run = useRun();
  const me = group.members.find((m) => m.id === state.me.id);
  const mine = new Set(me?.roles ?? []);
  const toggle = (key: string) => {
    const next = mine.has(key) ? [...mine].filter((k) => k !== key) : [...mine, key];
    void run(() => act({ action: "roles", roleKeys: next }));
  };
  return (
    <Panel className="flex flex-col gap-3">
      <p className="text-[1.05rem]">Choose one or more roles{state.session.rolesOptional ? " — or none, if you'd rather join in your own way" : ""}. Talk with your group so the important jobs are covered.</p>
      <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {state.session.roles.map((r) => {
          const holders = group.members.filter((m) => m.roles.includes(r.key));
          const selected = mine.has(r.key);
          return (
            <li key={r.key}>
              <button type="button" aria-pressed={selected} onClick={() => toggle(r.key)} className={cn("flex h-full w-full flex-col gap-1 rounded-2xl border-2 p-4 text-left transition", selected ? "border-sun bg-sun-soft shadow-lift" : "border-line bg-white hover:-translate-y-0.5 hover:shadow-lift")}>
                <span className="flex items-center justify-between gap-2 font-display text-lg font-bold">{r.name}{selected ? <span className="inline-flex size-7 items-center justify-center rounded-full bg-ink text-white"><Check className="size-4" aria-hidden="true" /></span> : null}</span>
                <span className="text-sm text-ink-muted">{r.description}</span>
                <span className={cn("mt-1 text-xs font-semibold", holders.length ? "text-purple" : "text-ink-faint")}>{holders.length ? holders.map((h) => (h.id === state.me.id ? "You" : h.name)).join(", ") : "Nobody yet"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {mine.size ? <p className="text-sm text-ink-muted" aria-live="polite">Your role{mine.size > 1 ? "s" : ""}: {[...mine].map((k) => roleName(state, k)).join(", ")}</p> : null}
    </Panel>
  );
}

function Voting() {
  const { group, act } = useWorkspace();
  const run = useRun();
  const left = group.votes.perStudent - group.votes.mine.length;
  const ideas = [...group.ideas.shared].sort((a, b) => (group.votes.tally[b.id] ?? 0) - (group.votes.tally[a.id] ?? 0));
  const max = Math.max(1, ...ideas.map((i) => group.votes.tally[i.id] ?? 0));
  return (
    <Panel className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-2 text-[1.05rem] font-semibold" aria-live="polite">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue px-3 py-1 text-white"><Vote className="size-4" aria-hidden="true" />{left} vote{left === 1 ? "" : "s"} left</span>
        <span className="font-normal text-ink-muted">Tap again to take a vote back.</span>
      </p>
      {ideas.length === 0 ? <Notice>No shared ideas to vote on yet.</Notice> : (
        <ul className="grid gap-2 xl:grid-cols-2">
          {ideas.map((i) => {
            const voted = group.votes.mine.includes(i.id);
            const n = group.votes.tally[i.id] ?? 0;
            return (
              <li key={i.id} className={cn("relative flex items-center gap-3 overflow-hidden rounded-2xl border-2 bg-white p-3", voted ? "border-blue" : "border-line")}>
                <span className="absolute inset-y-0 left-0 bg-blue-soft transition-all" style={{ width: `${(n / max) * 100}%` }} aria-hidden="true" />
                <div className="relative min-w-0 flex-1">
                  <p className="font-medium">{i.body}</p>
                  <p className="text-xs text-ink-muted">{i.author}</p>
                </div>
                <span className="relative font-display text-xl font-bold tabular-nums text-blue" aria-label={`${n} vote${n === 1 ? "" : "s"}`}>{n}</span>
                <Button size="sm" variant={voted ? "primary" : "secondary"} className={cn("relative", voted && "bg-blue hover:bg-blue")} aria-pressed={voted} disabled={!voted && left <= 0} onClick={() => run(() => act({ action: "vote", targetId: i.id }))}>
                  {voted ? <><Check />Voted</> : "Vote"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm text-ink-muted">Votes show the group&apos;s priorities — talk about the result before moving on. Don&apos;t want to vote? Press “I&apos;m ready” to pass.</p>
    </Panel>
  );
}

function Physical() {
  const { group, act } = useWorkspace();
  const run = useRun();
  const items = group.stage?.config.checkins ?? [];
  // Optimistic ticks: the box changes immediately; the server state wins on refresh.
  // Each entry remembers the server value it was based on; once the server's
  // value changes (our tick landed, or a groupmate changed it) the server wins.
  const [pending, setPending] = useState<Record<number, { value: boolean; base: boolean }>>({});
  const serverDone = (i: number) => group.checkins.includes(i);
  const isDone = (i: number) => (pending[i] && pending[i].base === serverDone(i) ? pending[i].value : serverDone(i));
  const toggle = async (i: number) => {
    setPending((p) => ({ ...p, [i]: { value: !isDone(i), base: serverDone(i) } }));
    const ok = await run(() => act({ action: "checkin", index: i }));
    if (!ok) setPending((p) => { const c = { ...p }; delete c[i]; return c; });
  };
  const doneCount = items.filter((_, i) => isDone(i)).length;
  return (
    <div className="flex flex-col gap-3">
      <Panel className="flex flex-col gap-3">
        <p className="rounded-2xl bg-teal-soft px-3 py-2 text-sm">This part happens in the room. Bloom doesn&apos;t listen to your group — tick off each check-in as you reach it.</p>
        {items.length ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 flex w-full items-center justify-between font-display text-lg font-bold">Check-ins <span className="text-sm font-semibold text-mint">{doneCount} of {items.length} done</span></legend>
            {items.map((label, i) => {
              const done = isDone(i);
              return (
                <label key={i} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-[1.05rem] transition", done ? "border-mint bg-mint-soft" : "border-line hover:border-mint/50")}>
                  <input type="checkbox" className="size-6 accent-[var(--mint)]" checked={done} onChange={() => void toggle(i)} />
                  <span className={cn(done && "line-through decoration-mint/60")}>{label}</span>
                </label>
              );
            })}
          </fieldset>
        ) : null}
      </Panel>
      {group.stage?.config.evidenceUpload ? <MediaUploader title="Photo evidence" /> : null}
    </div>
  );
}

function PresentationStage() {
  const { state, group, act } = useWorkspace();
  const run = useRun();
  if (state.session.presentation) return <PresentationViewer />;
  return (
    <Panel className="flex flex-col items-start gap-3">
      <p className="text-[1.05rem]">Your teacher will choose which group presents. When a group is presenting, their work appears here.</p>
      {group.submissions.length ? (
        group.presentationRequest === "pending"
          ? <Notice tone="blue">Your group has asked to present. Your teacher will decide.</Notice>
          : <Button variant="secondary" onClick={() => run(() => act({ action: "request_present" }), "Request sent to your teacher")}><Trophy />Ask to present our work</Button>
      ) : null}
    </Panel>
  );
}

function GroupReflection() {
  const { group, openChat } = useWorkspace();
  const prompts = group.stage?.config.prompts.length ? group.stage.config.prompts : ["What helped your group work well today?", "What would you do differently next time?"];
  return (
    <Panel className="flex flex-col gap-3">
      <ul className="grid gap-2 md:grid-cols-2">
        {prompts.map((p, i) => <li key={p} className={cn("rounded-2xl p-4 font-display text-lg font-semibold", ["bg-sun-soft", "bg-purple-soft", "bg-teal-soft", "bg-coral-soft"][i % 4])}>{p}</li>)}
      </ul>
      <p className="text-ink-muted">Talk about these together. You can jot your thoughts in the group chat if that&apos;s easier.</p>
      <Button variant="secondary" className="self-start" onClick={openChat}><MessagesSquare />Open group chat</Button>
      {group.stage?.config.evidenceUpload ? <MediaUploader title="Add a photo" /> : null}
    </Panel>
  );
}

function AllDone() {
  const { group, act, state } = useWorkspace();
  const run = useRun();
  const latest = group.submissions[0];
  return (
    <Panel className="flex flex-col items-center gap-4 py-8 text-center">
      <Buddy who="nova" size={130} mood="celebrate" />
      <h1 className="font-display text-3xl font-bold">Your group finished every stage. Nice teamwork!</h1>
      {latest ? <p className="text-ink-muted">Submitted version {latest.version} — {latest.status === "reviewed" ? "reviewed by your teacher" : latest.status === "returned" ? "returned for revision" : "waiting for your teacher"}.</p> : null}
      {latest?.feedback ? <Notice tone="teal" title="Teacher feedback" className="max-w-xl text-left">{latest.feedback}</Notice> : null}
      {state.session.presentation ? <PresentationViewer /> : latest && group.presentationRequest !== "pending" ? (
        <Button variant="secondary" onClick={() => run(() => act({ action: "request_present" }), "Request sent to your teacher")}><Trophy />Ask to present</Button>
      ) : null}
    </Panel>
  );
}
