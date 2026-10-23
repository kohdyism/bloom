"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { ChevronDown, HelpCircle, Lightbulb, MessageCircleMore, Send, Sparkles, Swords } from "lucide-react";
import { Buddy, useBuddy } from "@/components/buddy";
import { AiOriginBadge } from "@/components/live/ai-badge";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { useWorkspace } from "./context";

type Quick = "hint" | "explain_task" | "discussion_question" | "we_disagree" | "we_are_stuck";
const ASKS: [Quick, string, React.ElementType][] = [
  ["hint", "Give us a hint", Sparkles],
  ["explain_task", "Explain the task", HelpCircle],
  ["discussion_question", "Give us a question to discuss", Lightbulb],
  ["we_disagree", "We disagree — help us", Swords],
  ["we_are_stuck", "We're stuck", MessageCircleMore],
];

/** What Bloom says before it has said anything this stage (written, not AI). */
const TIPS: Record<string, string> = {
  orientation: "Read the task together. Can everyone say what your group will make by the end?",
  role_selection: "Pick a role that suits you — or none. Make sure the important jobs are covered.",
  brainstorm: "Quiet thinking time! Write your own idea first — nobody sees it until thinking time ends.",
  synthesis: "I've sorted your ideas into themes. Change anything that doesn't fit!",
  talk: "Screens down — talk face to face.",
  discussion: "Build on each other's ideas. Try “I agree with … because …” or “What if we …?”",
  voting: "Vote for the ideas that matter most. Then talk about the result.",
  creation: "Need an idea from earlier? Open the Ideas tab and press Add.",
  physical: "This part happens in the room. Tick off each check-in as you reach it.",
  submission: "Check your work together. Then one person submits it for the group.",
  presentation: "Your teacher chooses who presents. Think of one question to ask.",
  reflection: "What helped your group today? What would you try next time?",
};

/** Instant, written cheers for what the group does (never names or ranks anyone). */
const CHEERS = {
  myIdea: ["Nice idea! It stays private until thinking time ends.", "Great thinking — got another one?", "Love it. One more, or are you done thinking?"],
  myShared: ["Great addition — it's in your group's ideas now.", "Nice one! Can anyone build on it?"],
  groupIdea: ["Ooh, a new idea from your group!", "Your group's ideas are growing!"],
  build: ["Lovely — building on each other's ideas!", "That's teamwork: one idea growing from another."],
  vote: ["Vote counted!", "Got it! Talk about why it matters to you."],
  checkin: ["Check-in ticked — keep going, team!", "Nice progress!"],
  photo: ["Great photo — that's good evidence."],
  submitted: ["Submitted! Great teamwork, everyone."],
  ready: ["Thanks! Waiting for the rest of your group.", "You're ready — nice work!"],
};
const pick = (list: string[], n: number) => list[n % list.length];

/**
 * Bloom, at the top of the task: a persistent character with a speech bubble.
 * It introduces each stage, cheers the group on as they add and build on
 * ideas, and — when anyone taps it — offers a hint, explains the task, and so
 * on. Its answers appear in the bubble for the whole group.
 */
export function BloomCoach({ compact = false }: { compact?: boolean }) {
  const { group, act } = useWorkspace();
  const run = useRun();
  const buddy = useBuddy();
  const small = !useMediaQuery("(min-width: 640px)");
  const { fire, talkFor } = buddy;
  const kind = group.stage?.kind ?? "orientation";
  const [menu, setMenu] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState(false);
  // On phones, long messages start folded so the task keeps its room.
  const [moreKey, setMoreKey] = useState<string | null>(null);

  // Bloom's messages this stage (stage intro, answers to the group's requests).
  const since = group.stageStartedAt ? new Date(group.stageStartedAt).getTime() - 2000 : 0;
  const said = useMemo(() => group.messages.filter((m) => m.kind === "ai" && new Date(m.createdAt!).getTime() >= since), [group.messages, since]);
  const latest = said[said.length - 1];

  // A short-lived cheer when the group does something.
  const [cheer, setCheer] = useState<{ text: string; key: number } | null>(null);
  const counts = {
    myIdea: group.ideas.mine.filter((i) => i.status === "submitted").length,
    myShared: group.ideas.shared.filter((i) => i.mine).length,
    groupIdea: group.ideas.shared.filter((i) => !i.mine).length,
    build: group.ideas.shared.filter((i) => i.buildsOn).length,
    vote: group.votes.mine.length,
    checkin: group.checkins.length,
    photo: group.media.length,
    submitted: group.submissions.length,
    ready: group.myReadiness === "ready" ? 1 : 0,
  };
  const prev = useRef(counts);
  const stageRef = useRef(group.stageIndex);
  const key = JSON.stringify(counts);
  useEffect(() => {
    const before = prev.current;
    prev.current = counts;
    // A new stage resets the baseline without cheering.
    if (stageRef.current !== group.stageIndex) { stageRef.current = group.stageIndex; return; }
    const order: (keyof typeof CHEERS)[] = ["submitted", "build", "myShared", "myIdea", "groupIdea", "vote", "checkin", "photo", "ready"];
    const hit = order.find((k) => counts[k] > before[k]);
    if (!hit) return;
    // Reacting to what just happened in the group (a change in server state).
     
    setCheer({ text: pick(CHEERS[hit], counts[hit]), key: Date.now() });
    fire(hit === "submitted" || hit === "build" ? "cheer" : "hop");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, group.stageIndex, fire]);
  useEffect(() => {
    if (!cheer) return;
    const t = setTimeout(() => setCheer(null), 6000);
    return () => clearTimeout(t);
  }, [cheer]);

  // When Bloom says something new, it "speaks" and the cheer gives way.
  const lastSeen = useRef(latest?.id);
  useEffect(() => {
    if (latest?.id === lastSeen.current) return;
    lastSeen.current = latest?.id;
    // A new message from Bloom arrived from the server.
     
    setWaiting(false);
    setCheer(null);
    fire("hop");
    talkFor(2600);
  }, [latest?.id, fire, talkFor]);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setWaiting(false), 25_000);
    return () => clearTimeout(t);
  }, [waiting]);

  const ask = (quick: Quick | "question", text?: string) => {
    setMenu(false);
    setWaiting(true);
    setQuestion("");
    void run(() => act({ action: "ask_group_ai", quick, question: text })).then((ok) => { if (!ok) setWaiting(false); });
  };

  const text = waiting ? null : !group.aiEnabled && !cheer ? "Your teacher is facilitating directly for now — I'll be back soon!" : cheer?.text ?? latest?.body ?? TIPS[kind];
  const long = (text?.length ?? 0) > 110;
  const msgKey = String(cheer?.key ?? latest?.id ?? kind);
  const more = moreKey === msgKey;
  const fromAi = !waiting && !cheer && group.aiEnabled && latest;
  const ai = group.aiEnabled;
  return (
    <div className={cn("flex items-start gap-2 border-b border-line bg-gradient-to-r from-[#fff4ec] via-[#fff1f6] to-white", compact ? "px-3 py-2" : "px-3 py-3 sm:px-4")} data-tour="bloom-coach">
      <Popover.Root open={menu} onOpenChange={setMenu}>
        <Popover.Anchor asChild>
          <span className="shrink-0">
            <Buddy who="bloom" size={compact || small ? 44 : 60} mood={waiting ? "thinking" : cheer ? "celebrate" : "happy"} cue={buddy.cue} talking={buddy.talking && !waiting}
              onPress={() => setMenu((o) => !o)} pressLabel="Bloom, your group helper — tap for help" expanded={menu} />
          </span>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content side="bottom" align="start" sideOffset={8} collisionPadding={12} className="animate-pop z-50 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-1 rounded-2xl border border-line bg-white p-2 shadow-lift">
            <p className="px-2 pb-1 text-sm text-ink-muted">{ai ? "Bloom answers here, for your whole group." : "Your teacher is helping your group directly right now."}</p>
            {ai ? ASKS.map(([q, label, Icon]) => (
              <button key={q} type="button" onClick={() => ask(q)} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium hover:bg-[#fff1e8]">
                <Icon className="size-5 text-[#c4420a]" aria-hidden="true" />{label}
              </button>
            )) : null}
            {ai ? (
              <form className="mt-1 flex items-center gap-1.5 border-t border-line px-1 pt-2" onSubmit={(e) => { e.preventDefault(); if (question.trim()) ask("question", question.trim()); }}>
                <label htmlFor="ask-bloom" className="sr-only">Ask Bloom a question</label>
                <input id="ask-bloom" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="Or ask Bloom something…" className="h-10 min-w-0 flex-1 rounded-xl border-2 border-line px-3 text-sm outline-none focus:border-[#ff9f80]" />
                <button type="submit" disabled={!question.trim()} className="inline-flex size-10 items-center justify-center rounded-xl bg-ink text-white disabled:opacity-40" aria-label="Ask Bloom"><Send className="size-4" /></button>
              </form>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <div className="min-w-0 flex-1">
        <div className={cn("relative rounded-2xl rounded-tl-sm border-2 border-[#ffd2c4] bg-white shadow-soft", compact ? "px-3 py-1.5" : "px-3.5 py-2")} aria-live="polite">
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            <span className="font-semibold text-ink">Bloom</span>
            {fromAi ? <AiOriginBadge origin={latest.aiOrigin} /> : null}
            <button type="button" onClick={() => setMenu((o) => !o)} className="ml-auto inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold text-[#c4420a] hover:bg-[#fff1e8]" aria-expanded={menu}>
              Ask Bloom<ChevronDown className="size-3.5" aria-hidden="true" />
            </button>
          </p>
          {waiting ? (
            <p className="flex items-center gap-2 py-0.5 text-ink-muted" role="status">
              <span className="flex gap-1" aria-hidden="true"><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:200ms]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:400ms]" /></span>
              Bloom is thinking…
            </p>
          ) : (
            <>
              <p key={msgKey} className={cn("msg-in whitespace-pre-line leading-snug", compact ? "text-[0.95rem]" : "text-[1.02rem]", long && !more && "max-sm:line-clamp-3")}>{text}</p>
              {long ? <button type="button" className="text-xs font-semibold text-[#c4420a] sm:hidden" aria-expanded={more} onClick={() => setMoreKey(more ? null : msgKey)}>{more ? "Show less" : "Read more"}</button> : null}
            </>
          )}
        </div>
        {said.length > 1 ? (
          <div className="mt-1 pl-1">
            <button type="button" className="text-xs font-semibold text-ink-muted hover:text-ink" aria-expanded={history} onClick={() => setHistory((h) => !h)}>
              {history ? "Hide" : "See"} what Bloom said earlier ({said.length - 1})
            </button>
            {history ? (
              <ol className="mt-1 flex flex-col gap-1.5">
                {said.slice(0, -1).reverse().map((m) => <li key={m.id} className="rounded-xl bg-white/80 px-3 py-1.5 text-sm text-ink/80">{m.body}</li>)}
              </ol>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
