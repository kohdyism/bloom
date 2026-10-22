"use client";

import { useState } from "react";
import { Check, ChevronDown, HelpCircle, Lightbulb, MessagesSquare, Sparkles, Swords, Trophy, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Notice } from "@/components/ui/primitives";
import { StageIcon } from "@/components/stage-icon";
import { MascotSays } from "@/components/mascot";
import { useA11y } from "@/components/a11y-provider";
import { useRun } from "@/components/ui/toast";
import { STAGE_META } from "@/lib/domain/lesson";
import { cn } from "@/lib/utils";
import { useWorkspace, roleName } from "./context";
import { ReadinessBar } from "./readiness-bar";
import { Brainstorm } from "./stage-brainstorm";
import { Synthesis } from "./stage-synthesis";
import { Discussion } from "./chat";
import { Creation } from "./stage-creation";
import { Submission } from "./stage-submission";
import { PresentationViewer } from "./presentation";
import { MediaUploader } from "./media";

export function StagePanel() {
  const { group } = useWorkspace();
  if (group.stageStatus === "complete") return <AllDone />;
  const kind = group.stage?.kind;
  return (
    <div className="flex flex-col gap-5">
      <StageHeader />
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
      {group.timer.paused ? <Notice tone="amber" title="Paused">Your teacher has paused things for a moment. Your work is saved.</Notice> : null}
      {kind !== "submission" ? <ReadinessBar readyLabel={kind === "brainstorm" ? "I'm done thinking" : "I'm ready"} /> : <ReadinessBar />}
    </div>
  );
}

/** Stage title + instructions, with a private "explain it differently" option. */
function StageHeader() {
  const { group, openAssistant, act } = useWorkspace();
  const { prefs } = useA11y();
  const run = useRun();
  const [showFull, setShowFull] = useState(!prefs.simplifiedInstructions);
  const stage = group.stage!;
  const sentences = stage.instructions.split(/(?<=[.?!])\s+/).filter(Boolean);
  const short = sentences[0] ?? "";
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <StageIcon kind={stage.kind} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-teal">{STAGE_META[stage.kind].label}</p>
          <h1 className="font-display text-2xl font-bold">{stage.title}</h1>
        </div>
      </div>
      {stage.instructions ? (
        <div className="mt-3">
          {prefs.simplifiedInstructions && sentences.length > 1 ? (
            <p className="rounded-xl bg-teal-soft px-3 py-2 font-medium">In short: {short}</p>
          ) : null}
          {showFull || sentences.length <= 1 || !prefs.simplifiedInstructions ? (
            <p className="mt-2 whitespace-pre-line text-[1.05rem] leading-relaxed">{stage.instructions}</p>
          ) : (
            <Button variant="link" size="sm" onClick={() => setShowFull(true)}><ChevronDown className="size-4" />Show full instructions</Button>
          )}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="soft" className="bg-purple-soft text-purple" onClick={() => openAssistant({ action: "explain_simply" })}><Sparkles />Explain it differently <span className="sr-only">(private)</span></Button>
        <Button size="sm" variant="ghost" onClick={() => openAssistant({ action: "break_into_steps" })}>Break into steps</Button>
        {group.aiEnabled ? (
          <details className="relative">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-ink-muted hover:bg-surface-2"><MessagesSquare className="size-4" aria-hidden="true" />Ask Sprout as a group<ChevronDown className="size-3.5" aria-hidden="true" /></summary>
            <div className="absolute left-0 top-10 z-20 flex w-64 flex-col gap-1 rounded-xl border border-line bg-surface p-2 shadow-lift">
              <p className="px-2 pb-1 text-xs text-ink-muted">Sprout replies in your group chat for everyone.</p>
              {([
                ["explain_task", "Explain the task to us", HelpCircle],
                ["discussion_question", "Give us a discussion question", Lightbulb],
                ["we_disagree", "Help us with a disagreement", Swords],
                ["we_are_stuck", "We're stuck", HelpCircle],
              ] as const).map(([quick, label, Icon]) => (
                <button key={quick} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2" onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; void run(() => act({ action: "ask_group_ai", quick }), "Sprout is replying in your group chat"); }}>
                  <Icon className="size-4 text-purple" aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          </details>
        ) : <Badge>Your teacher is facilitating directly</Badge>}
      </div>
    </Card>
  );
}

function Orientation() {
  const { state } = useWorkspace();
  return (
    <MascotSays mood="wave">
      <p>Read the task together and check everyone knows what your group will make by the end. {state.session.modality === "mostly_in_person" ? "Most of today happens in the room — Bloom keeps track of the steps." : "You can talk in the room, use the group chat, or both."}</p>
    </MascotSays>
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
    <div className="flex flex-col gap-3">
      <p className="text-ink-muted">Choose one or more roles{state.session.rolesOptional ? " — or none, if you'd rather contribute in your own way" : ""}. Talk with your group so the important jobs are covered.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {state.session.roles.map((r) => {
          const holders = group.members.filter((m) => m.roles.includes(r.key));
          const selected = mine.has(r.key);
          return (
            <li key={r.key}>
              <button type="button" aria-pressed={selected} onClick={() => toggle(r.key)} className={cn("flex h-full w-full flex-col gap-1 rounded-2xl border-2 p-4 text-left transition-colors", selected ? "border-teal bg-teal-soft" : "border-line bg-surface hover:border-line-strong")}>
                <span className="flex items-center justify-between gap-2 font-semibold">{r.name}{selected ? <Check className="size-5 text-teal" aria-hidden="true" /> : null}</span>
                <span className="text-sm text-ink-muted">{r.description}</span>
                {holders.length ? <span className="mt-1 text-xs font-semibold text-purple">{holders.map((h) => (h.id === state.me.id ? "You" : h.name)).join(", ")}</span> : <span className="mt-1 text-xs text-ink-faint">Nobody yet</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {mine.size ? <p className="text-sm text-ink-muted" aria-live="polite">Your role{mine.size > 1 ? "s" : ""}: {[...mine].map((k) => roleName(state, k)).join(", ")}</p> : null}
    </div>
  );
}

function Voting() {
  const { group, act } = useWorkspace();
  const run = useRun();
  const left = group.votes.perStudent - group.votes.mine.length;
  const ideas = [...group.ideas.shared].sort((a, b) => (group.votes.tally[b.id] ?? 0) - (group.votes.tally[a.id] ?? 0));
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold" aria-live="polite"><Vote className="mr-1 inline size-4 align-[-2px] text-blue" aria-hidden="true" />You have {left} vote{left === 1 ? "" : "s"} left. Tap again to take a vote back.</p>
      {ideas.length === 0 ? <Notice>No shared ideas to vote on yet.</Notice> : (
        <ul className="flex flex-col gap-2">
          {ideas.map((i) => {
            const voted = group.votes.mine.includes(i.id);
            const n = group.votes.tally[i.id] ?? 0;
            return (
              <li key={i.id} className={cn("flex items-center gap-3 rounded-2xl border bg-surface p-3", voted ? "border-blue" : "border-line")}>
                <div className="min-w-0 flex-1">
                  <p>{i.body}</p>
                  <p className="text-xs text-ink-muted">{i.author}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink-muted" aria-label={`${n} vote${n === 1 ? "" : "s"}`}>{n}</span>
                <Button size="sm" variant={voted ? "primary" : "secondary"} aria-pressed={voted} disabled={!voted && left <= 0} onClick={() => run(() => act({ action: "vote", targetId: i.id }))}>
                  {voted ? <><Check />Voted</> : "Vote"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm text-ink-muted">Votes show the group&apos;s priorities — talk about the result before moving on. Don&apos;t want to vote? Tap “I&apos;m ready” to pass.</p>
    </div>
  );
}

function Physical() {
  const { group, act } = useWorkspace();
  const run = useRun();
  const items = group.stage?.config.checkins ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Notice tone="teal">This part happens in the room. Bloom doesn&apos;t listen to your group — tick off each check-in as you reach it.</Notice>
      {items.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Check-ins</legend>
          {items.map((label, i) => {
            const done = group.checkins.includes(i);
            return (
              <label key={i} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-surface px-4 py-3", done ? "border-mint bg-mint-soft" : "border-line")}>
                <input type="checkbox" className="size-5 accent-[var(--mint)]" checked={done} onChange={() => run(() => act({ action: "checkin", index: i }))} />
                <span className={cn(done && "line-through decoration-mint/60")}>{label}</span>
              </label>
            );
          })}
        </fieldset>
      ) : null}
      {group.stage?.config.evidenceUpload ? <MediaUploader title="Photo evidence" /> : null}
    </div>
  );
}

function PresentationStage() {
  const { state, group, act } = useWorkspace();
  const run = useRun();
  if (state.session.presentation) return <PresentationViewer />;
  return (
    <div className="flex flex-col gap-3">
      <MascotSays mood="idle">Your teacher will choose which group presents. When a group is presenting, their work appears here.</MascotSays>
      {group.submissions.length ? (
        group.presentationRequest === "pending"
          ? <Notice tone="blue">Your group has asked to present. Your teacher will decide.</Notice>
          : <Button className="self-start" variant="secondary" onClick={() => run(() => act({ action: "request_present" }), "Request sent to your teacher")}><Trophy />Ask to present our work</Button>
      ) : null}
    </div>
  );
}

function GroupReflection() {
  const { group, openChat } = useWorkspace();
  const prompts = group.stage?.config.prompts.length ? group.stage.config.prompts : ["What helped your group work well today?", "What would you do differently next time?"];
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {prompts.map((p) => <li key={p} className="rounded-2xl border border-line bg-surface p-4 font-medium">{p}</li>)}
      </ul>
      <p className="text-ink-muted">Talk about these together. You can jot your thoughts in the group chat if that&apos;s easier.</p>
      <Button variant="secondary" className="self-start" onClick={openChat}><MessagesSquare />Open group chat</Button>
      {group.stage?.config.evidenceUpload ? <MediaUploader title="Add a photo" /> : null}
    </div>
  );
}

function AllDone() {
  const { group, act, state } = useWorkspace();
  const run = useRun();
  const latest = group.submissions[0];
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <MascotSays mood="celebrate" size={90}><span className="font-display text-xl font-semibold">Your group finished every stage. Nice teamwork!</span></MascotSays>
      {latest ? <p className="text-ink-muted">Submitted version {latest.version} — {latest.status === "reviewed" ? "reviewed by your teacher" : latest.status === "returned" ? "returned for revision" : "waiting for your teacher"}.</p> : null}
      {latest?.feedback ? <Notice tone="teal" title="Teacher feedback" className="max-w-xl text-left">{latest.feedback}</Notice> : null}
      {state.session.presentation ? <PresentationViewer /> : latest && group.presentationRequest !== "pending" ? (
        <Button variant="secondary" onClick={() => run(() => act({ action: "request_present" }), "Request sent to your teacher")}><Trophy />Ask to present</Button>
      ) : null}
    </div>
  );
}
