"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle, Lightbulb, ListChecks, Lock, MessageCircleMore, Sparkles, Swords, Target } from "lucide-react";
import { STAGE_META } from "@/lib/domain/lesson";
import { STAGE_ICONS } from "@/components/stage-icon";
import { SproutBuddy } from "@/components/sprout-buddy";
import { AiOriginBadge } from "@/components/live/ai-badge";
import { HoverInfo } from "@/components/ui/hover-info";
import { useA11y } from "@/components/a11y-provider";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";
import { Materials } from "./materials";

type Quick = "explain_task" | "discussion_question" | "we_disagree" | "we_are_stuck";
const GROUP_ASKS: [Quick, string, React.ElementType][] = [
  ["explain_task", "Explain the task to us", HelpCircle],
  ["discussion_question", "Give us a discussion question", Lightbulb],
  ["we_disagree", "Help us with a disagreement", Swords],
  ["we_are_stuck", "We're stuck", MessageCircleMore],
];

/** Scripted, clearly-not-AI tips Sprout shows before the AI has said anything. */
const TIPS: Record<string, string> = {
  orientation: "Read the task together. Can everyone say, in one sentence, what your group will make by the end?",
  role_selection: "Pick a role that suits you — or none. Check the important jobs are covered.",
  brainstorm: "Quiet thinking time. Write your own idea first — nobody else can see it until thinking time ends.",
  synthesis: "I've grouped your ideas into themes. Do they make sense? Change anything that doesn't fit.",
  discussion: "Build on each other's ideas. Try: “I agree with … because …” or “What if we …?”",
  voting: "Vote for the ideas you think matter most. Talk about the result before you move on.",
  creation: "Your idea bank is on the left — add any idea straight into your work with one tap.",
  physical: "This part happens in the room. Tick off each check-in as your group reaches it.",
  submission: "Check your work together, then one person submits it for the whole group.",
  presentation: "Your teacher chooses who presents. Listen out for one thing you'd like to ask.",
  reflection: "Think about what helped your group today — and what you'd try next time.",
};

/**
 * The top of the centre column, always in view: what we're doing (the task)
 * and who's helping (Sprout, the group facilitator), with the ways to ask
 * Sprout one tap away. Collapses to a slim bar — Sprout stays visible.
 */
export function StageHero() {
  const { group, state, act, openAssistant, openChat } = useWorkspace();
  const { prefs } = useA11y();
  const run = useRun();
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const stage = group.stage!;
  const { icon: Icon, tone } = STAGE_ICONS[stage.kind];
  const sentences = stage.instructions.split(/(?<=[.?!])\s+/).filter(Boolean);
  const shortFirst = prefs.simplifiedInstructions && sentences.length > 1 && !showAll;

  const aiMessages = group.messages.filter((m) => m.kind === "ai");
  const latest = aiMessages[aiMessages.length - 1];
  const [waiting, setWaiting] = useState(false);
  const lastSeen = useRef(latest?.id);
  useEffect(() => {
    if (latest?.id !== lastSeen.current) {
      lastSeen.current = latest?.id;
      // A new facilitator message arrived from the server: stop "thinking".
      setWaiting(false);
    }
  }, [latest?.id]);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setWaiting(false), 20_000);
    return () => clearTimeout(t);
  }, [waiting]);
  const ask = (quick: Quick) => {
    setWaiting(true);
    void run(() => act({ action: "ask_group_ai", quick })).then((ok) => { if (!ok) setWaiting(false); });
  };

  const say = !group.aiEnabled ? null : waiting ? null : latest ? latest.body : TIPS[stage.kind];
  const bubble = !group.aiEnabled ? (
    <p><strong>Your teacher is facilitating directly</strong> right now. Sprout is resting — you can still ask privately.</p>
  ) : waiting ? (
    <p className="flex items-center gap-2 text-ink-muted"><span className="flex gap-1" aria-hidden="true"><span className="animate-pulse-dot size-2 rounded-full bg-purple" /><span className="animate-pulse-dot size-2 rounded-full bg-purple [animation-delay:200ms]" /><span className="animate-pulse-dot size-2 rounded-full bg-purple [animation-delay:400ms]" /></span>Sprout is thinking…</p>
  ) : (
    <p className={cn("whitespace-pre-line", collapsed ? "line-clamp-1" : "line-clamp-3")}>{!latest ? <span className="sr-only">Tip: </span> : null}{say}</p>
  );

  const goals = state.session.objectives.length || state.session.materials.length ? (
    <HoverInfo align="end" className="max-w-sm" content={
      <div className="flex flex-col gap-2">
        {state.session.objectives.length ? <><p className="font-display text-base font-semibold">Today you&apos;ll…</p><ul className="list-disc space-y-0.5 pl-5">{state.session.objectives.map((o) => <li key={o}>{o}</li>)}</ul></> : null}
        <Materials materials={state.session.materials} />
      </div>
    }>
      <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-blue-soft px-2.5 text-sm font-semibold text-blue hover:brightness-95"><Target className="size-4" aria-hidden="true" />Goals</button>
    </HoverInfo>
  ) : null;
  const toggle = (
    <button type="button" onClick={() => setCollapsed((c) => !c)} className="inline-flex size-8 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-2" aria-expanded={!collapsed} aria-label={collapsed ? "Show the full task and Sprout" : "Make the task and Sprout smaller"}>
      {collapsed ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
    </button>
  );

  if (collapsed) {
    return (
      <section aria-label="This stage" className="flex shrink-0 items-center gap-3 rounded-3xl border-2 border-white bg-white/90 px-3 py-2 shadow-soft">
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl", tone)} aria-hidden="true"><Icon className="size-5" /></span>
        <h1 className="shrink-0 font-display text-lg font-bold">{stage.title}</h1>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-2 py-1" style={{ background: "linear-gradient(90deg, #ebe3ff, #ffe4ef)" }}>
          <SproutBuddy size={40} mood={waiting ? "thinking" : "happy"} bubbleSide="right" />
          <div className="min-w-0 flex-1 text-sm" aria-live="polite">{bubble}</div>
        </div>
        {goals}
        {toggle}
      </section>
    );
  }

  return (
    <section aria-label="This stage" className="shrink-0 overflow-hidden rounded-3xl border-2 border-white bg-white/90 shadow-soft">
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* The task */}
        <div className="flex min-w-0 flex-col gap-1.5 p-4">
          <div className="flex items-start gap-3">
            <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-2xl", tone)} aria-hidden="true"><Icon className="size-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-purple">Stage {group.stageIndex + 1} of {state.session.stages.length} · {STAGE_META[stage.kind].label}</p>
              <h1 className="font-display text-2xl font-bold leading-tight">{stage.title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-1 md:hidden">{goals}{toggle}</div>
          </div>
          {stage.instructions ? (
            shortFirst ? (
              <div>
                <p className="rounded-xl bg-teal-soft px-3 py-1.5 font-medium">In short: {sentences[0]}</p>
                <button type="button" className="mt-1 text-sm font-semibold text-teal underline-offset-4 hover:underline" onClick={() => setShowAll(true)}>Show full instructions</button>
              </div>
            ) : (
              <p className="whitespace-pre-line text-[1.02rem] leading-snug">{stage.instructions}</p>
            )
          ) : null}
        </div>
        {/* Sprout, the facilitator */}
        <div className="relative flex min-w-0 items-start gap-3 p-4" style={{ background: "linear-gradient(135deg, #ebe3ff 0%, #f6e6ff 50%, #ffe4ef 100%)" }}>
          <SproutBuddy size={84} mood={waiting ? "thinking" : latest ? "happy" : "wave"} bubbleSide="top" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 truncate text-sm font-bold text-purple-strong">Sprout <span className="font-semibold text-ink-muted">· group facilitator</span></h2>
              <span className="ml-auto hidden shrink-0 items-center gap-1 md:flex">{goals}{toggle}</span>
            </div>
            <div className="mt-1.5 rounded-2xl rounded-tl-md bg-white px-3.5 py-2 leading-snug shadow-soft" aria-live="polite">
              {bubble}
              {latest && group.aiEnabled && !waiting ? <AiOriginBadge origin={latest.aiOrigin} className="mt-1" /> : null}
              {latest && group.aiEnabled && !waiting && latest.body.length > 200 ? (
                <button type="button" onClick={openChat} className="mt-0.5 text-sm font-semibold text-purple underline-offset-4 hover:underline">Read it all in the chat</button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {/* Ways to ask Sprout */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-white bg-purple-soft/60 px-4 py-2.5">
        {group.aiEnabled ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ask Sprout as a group">
            <span className="mr-1 text-xs font-bold uppercase tracking-wide text-purple-strong">Ask as a group</span>
            {GROUP_ASKS.map(([quick, label, QIcon]) => (
              <button key={quick} type="button" disabled={waiting} onClick={() => ask(quick)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-purple px-3 text-sm font-semibold text-white shadow-soft transition hover:bg-purple-strong disabled:opacity-60">
                <QIcon className="size-4" aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-muted"><Lock className="size-3.5" aria-hidden="true" />Just for me</span>
          <button type="button" onClick={() => openAssistant()} className="inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-purple/40 bg-white px-3 text-sm font-semibold text-purple hover:border-purple">
            <Sparkles className="size-4" aria-hidden="true" />Ask Sprout <span className="sr-only">(private)</span>
          </button>
          <button type="button" onClick={() => openAssistant({ action: "explain_simply" })} className="inline-flex h-8 items-center rounded-full bg-white px-3 text-sm font-medium text-ink hover:bg-white/70">Explain it differently <span className="sr-only">(private)</span></button>
          <button type="button" onClick={() => openAssistant({ action: "break_into_steps" })} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-ink hover:bg-white/70"><ListChecks className="size-4" aria-hidden="true" />Break into steps</button>
        </div>
      </div>
    </section>
  );
}
