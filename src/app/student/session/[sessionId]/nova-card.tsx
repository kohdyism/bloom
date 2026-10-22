"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, HelpCircle, Lightbulb, MessageCircleMore, Swords } from "lucide-react";
import { Buddy } from "@/components/buddy";
import { AiOriginBadge } from "@/components/live/ai-badge";
import { useRun } from "@/components/ui/toast";
import { useWorkspace } from "./context";

type Quick = "explain_task" | "discussion_question" | "we_disagree" | "we_are_stuck";
const GROUP_ASKS: [Quick, string, React.ElementType][] = [
  ["explain_task", "Explain the task to us", HelpCircle],
  ["discussion_question", "Give us a discussion question", Lightbulb],
  ["we_disagree", "Help us with a disagreement", Swords],
  ["we_are_stuck", "We're stuck", MessageCircleMore],
];

/** Written tips (not AI) Nova shows before it has said anything to the group. */
const TIPS: Record<string, string> = {
  orientation: "Read the task together. Can everyone say what your group will make by the end?",
  role_selection: "Pick a role that suits you — or none. Make sure the important jobs are covered.",
  brainstorm: "Quiet thinking time. Write your own idea first — nobody sees it until thinking time ends.",
  synthesis: "Your ideas are grouped into themes. Change anything that doesn't fit.",
  discussion: "Build on each other's ideas. Try “I agree with … because …” or “What if we …?”",
  voting: "Vote for the ideas that matter most. Then talk about the result.",
  creation: "Need an idea from earlier? Open Ideas at the bottom and press Add.",
  physical: "This part happens in the room. Tick off each check-in as you reach it.",
  submission: "Check your work together. Then one person submits it for the group.",
  presentation: "Your teacher chooses who presents. Think of one question to ask.",
  reflection: "What helped your group today? What would you try next time?",
};

/** Nova, the group facilitator: one message at a time, everyone in the group sees it. */
export function NovaCard() {
  const { group, act } = useWorkspace();
  const run = useRun();
  const kind = group.stage?.kind ?? "orientation";
  const aiMessages = group.messages.filter((m) => m.kind === "ai");
  const latest = aiMessages[aiMessages.length - 1];
  const [waiting, setWaiting] = useState(false);
  const [menu, setMenu] = useState(false);
  const lastSeen = useRef(latest?.id);
  useEffect(() => {
    if (latest?.id !== lastSeen.current) {
      lastSeen.current = latest?.id;
      // A new message from Nova arrived from the server: stop "thinking".
      setWaiting(false);
    }
  }, [latest?.id]);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setWaiting(false), 20_000);
    return () => clearTimeout(t);
  }, [waiting]);
  const ask = (quick: Quick) => {
    setMenu(false);
    setWaiting(true);
    void run(() => act({ action: "ask_group_ai", quick })).then((ok) => { if (!ok) setWaiting(false); });
  };

  return (
    <section aria-labelledby="nova-title" className="flex items-start gap-4 rounded-[1.75rem] border-2 border-white bg-gradient-to-r from-[#fff1e8] via-[#ffeef5] to-white p-4 shadow-soft">
      <Buddy who="nova" size={76} mood={waiting ? "thinking" : latest ? "happy" : "idle"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 id="nova-title" className="font-display text-lg font-bold">Nova</h2>
          <span className="text-sm text-ink-muted">your group&apos;s helper · everyone sees this</span>
          {latest && group.aiEnabled && !waiting ? <AiOriginBadge origin={latest.aiOrigin} /> : null}
        </div>
        <div className="mt-1 text-[1.08rem] leading-snug" aria-live="polite">
          {!group.aiEnabled ? (
            <p><strong>Your teacher is facilitating directly</strong> for now. You can still ask Pip privately.</p>
          ) : waiting ? (
            <p className="flex items-center gap-2 text-ink-muted"><span className="flex gap-1" aria-hidden="true"><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:200ms]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:400ms]" /></span>Nova is thinking…</p>
          ) : latest ? (
            <p className="whitespace-pre-line">{latest.body}</p>
          ) : (
            <p><span className="sr-only">Tip: </span>{TIPS[kind]}</p>
          )}
        </div>
      </div>
      {group.aiEnabled ? (
        <div className="relative shrink-0" onKeyDown={(e) => { if (e.key === "Escape") setMenu(false); }}>
          <button type="button" disabled={waiting} aria-expanded={menu} aria-haspopup="menu" aria-controls="nova-menu" onClick={() => setMenu((o) => !o)}
            className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-ink px-4 font-semibold text-white shadow-soft hover:bg-ink/85 disabled:opacity-60">
            Ask Nova<ChevronDown className="size-4" aria-hidden="true" />
          </button>
          {menu ? (
            <div id="nova-menu" role="menu" aria-label="Ask Nova as a group" className="animate-pop absolute right-0 top-12 z-30 flex w-72 flex-col gap-1 rounded-2xl border border-line bg-white p-2 shadow-lift">
              <p className="px-2 pb-1 text-sm text-ink-muted">Nova answers here, for your whole group.</p>
              {GROUP_ASKS.map(([quick, label, Icon]) => (
                <button key={quick} type="button" role="menuitem" onClick={() => ask(quick)} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium hover:bg-[#fff1e8]">
                  <Icon className="size-5 text-[#e8590c]" aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
