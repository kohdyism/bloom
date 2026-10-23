"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { ChevronDown, HelpCircle, Lightbulb, MessageCircleMore, Send, Sparkles, Swords } from "lucide-react";
import { Buddy, useBuddy } from "@/components/buddy";
import { AiOriginBadge } from "@/components/live/ai-badge";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { mentionsHelper } from "@/lib/domain/mentions";
import { useNow } from "@/lib/use-now";
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
 * Bloom, the group's helper, beside the task: a persistent character with a
 * speech bubble. It introduces each stage, cheers the group on as they add
 * and build on ideas, and — when anyone taps it — offers a hint, explains the
 * task, and so on. Its answers appear here for the whole group (never twice:
 * the group chat is for people).
 *  - "rail": a slim column beside the task on bigger screens;
 *  - "bar": one line above the task on phones — tap to read more and ask.
 */
export function BloomCoach({ variant = "rail", className }: { variant?: "rail" | "bar"; className?: string }) {
  const { group, act, state } = useWorkspace();
  const run = useRun();
  const buddy = useBuddy();
  const [open, setOpen] = useState(false);
  const { fire, talkFor } = buddy;
  const kind = group.stage?.kind ?? "orientation";
  const [menu, setMenu] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState(false);

  // Bloom's messages this stage (stage intro, answers to the group's requests).
  const since = group.stageStartedAt ? new Date(group.stageStartedAt).getTime() - 2000 : 0;
  const said = useMemo(() => group.messages.filter((m) => m.kind === "ai" && new Date(m.createdAt!).getTime() >= since), [group.messages, since]);
  const latest = said[said.length - 1];
  const now = useNow();
  // Someone asked Bloom in the chat ("@Bloom …"): show who asked what, and that Bloom is thinking.
  const lastMention = [...group.messages].reverse().find((m) => m.kind === "student" && mentionsHelper(m.body));
  const mentionPending = !!lastMention && (!latest || new Date(lastMention.createdAt!) > new Date(latest.createdAt!)) && now - new Date(lastMention.createdAt!).getTime() < 30_000;
  const askedFor = latest && lastMention && new Date(lastMention.createdAt!) < new Date(latest.createdAt!) && new Date(latest.createdAt!).getTime() - new Date(lastMention.createdAt!).getTime() < 60_000 ? lastMention : null;

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

  const thinking = waiting || (mentionPending && group.aiEnabled);
  const text = thinking ? null : !group.aiEnabled && !cheer ? "Your teacher is facilitating directly for now — I'll be back soon!" : cheer?.text ?? latest?.body ?? TIPS[kind];
  const msgKey = String(cheer?.key ?? latest?.id ?? kind);
  const fromAi = !thinking && !cheer && group.aiEnabled && latest;
  const ai = group.aiEnabled;
  const bar = variant === "bar";

  const helpMenu = (
    <Popover.Portal>
      <Popover.Content side="bottom" align="end" sideOffset={8}
        // Tapping Bloom toggles the menu itself, so it doesn't count as "outside".
        onInteractOutside={(e) => { if (e.target instanceof Element && e.target.closest("[data-bloom-button]")) e.preventDefault(); }} collisionPadding={12} className="animate-pop z-[65] flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-1 rounded-2xl border border-line bg-white p-2 shadow-lift">
        <p className="px-2 pb-1 text-sm text-ink-muted">{ai ? "Bloom answers for your whole group." : "Your teacher is helping your group directly right now."}</p>
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
  );
  const message = thinking ? (
    <p className="flex items-center gap-2 py-0.5 text-ink-muted" role="status">
      <span className="flex gap-1" aria-hidden="true"><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:200ms]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:400ms]" /></span>
      Bloom is thinking…
    </p>
  ) : (
    <>
      {askedFor && !cheer ? <p className="mb-1 truncate border-l-2 border-[#ffd2c4] pl-2 text-xs text-ink-muted">{askedFor.authorId === state.me.id ? "You" : "Your group"} asked: {askedFor.body}</p> : null}
      <p key={msgKey} className="msg-in whitespace-pre-line text-[0.98rem] leading-snug">{text}</p>
    </>
  );
  const askButton = (
    <Popover.Trigger asChild>
      <button type="button" className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-[#fff1e8] px-3 text-sm font-semibold text-[#c4420a] hover:brightness-95">
        Ask Bloom<ChevronDown className="size-4" aria-hidden="true" />
      </button>
    </Popover.Trigger>
  );

  if (bar) {
    // Phones: one line. Tap it to read the whole message and see earlier ones.
    return (
      <Popover.Root open={menu} onOpenChange={setMenu}>
        <div className={cn("border-b border-line bg-gradient-to-r from-[#fff4ec] via-[#fff1f6] to-white px-2.5 py-1.5", className)} data-tour="bloom-coach">
          <div className="flex items-center gap-2">
            <span className="shrink-0" data-bloom-button>
              <Buddy who="bloom" size={36} mood={thinking ? "thinking" : cheer ? "celebrate" : "happy"} cue={buddy.cue} talking={buddy.talking && !thinking}
                  onPress={() => setMenu((o) => !o)} pressLabel="Bloom, your group helper — tap for help" expanded={menu} />
              </span>
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 flex-1 text-left" aria-live="polite">
              <span className="sr-only">Bloom says: </span>
              {thinking ? <span className="text-sm text-ink-muted">Bloom is thinking…</span> : <span className={cn("block text-sm leading-snug", !open && "truncate")}>{text}</span>}
            </button>
            {askButton}
          </div>
          {open && !thinking ? (
            <div className="mt-1.5 flex flex-col gap-1.5 pl-11">
              {fromAi ? <AiOriginBadge origin={latest.aiOrigin} className="self-start" /> : null}
              {said.length > 1 ? <ol className="flex flex-col gap-1">{said.slice(0, -1).reverse().map((m) => <li key={m.id} className="rounded-xl bg-white/80 px-2.5 py-1 text-xs text-ink/80">{m.body}</li>)}</ol> : null}
            </div>
          ) : null}
        </div>
        {helpMenu}
      </Popover.Root>
    );
  }

  return (
    <Popover.Root open={menu} onOpenChange={setMenu}>
      <section aria-label="Bloom, your group helper" className={cn("flex min-h-0 flex-col gap-2 overflow-y-auto rounded-[1.75rem] border-2 border-white bg-gradient-to-b from-[#fff4ec] via-[#fff1f6] to-white/95 p-3 shadow-soft", className)} data-tour="bloom-coach">
        <div className="flex items-center gap-2">
          <span className="shrink-0" data-bloom-button>
            <Buddy who="bloom" size={56} mood={thinking ? "thinking" : cheer ? "celebrate" : "happy"} cue={buddy.cue} talking={buddy.talking && !thinking}
                onPress={() => setMenu((o) => !o)} pressLabel="Bloom, your group helper — tap for help" expanded={menu} />
            </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold leading-tight">Bloom</p>
            <p className="text-xs text-ink-muted">Your group&apos;s helper</p>
          </div>
          {askButton}
        </div>
        <div className="relative rounded-2xl rounded-tl-sm border-2 border-[#ffd2c4] bg-white px-3 py-2 shadow-soft" aria-live="polite">
          {fromAi ? <AiOriginBadge origin={latest.aiOrigin} className="mb-1" /> : null}
          {message}
        </div>
        {said.length > 1 ? (
          <div className="pl-1">
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
      </section>
      {helpMenu}
    </Popover.Root>
  );
}
