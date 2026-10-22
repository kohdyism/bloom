"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, HelpCircle, Lightbulb, MessageCircleMore, Swords } from "lucide-react";
import { Buddy } from "@/components/buddy";
import { Nova } from "@/components/mascot";
import { useRun } from "@/components/ui/toast";
import { useWorkspace } from "./context";
import { Chat } from "./chat";

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
  creation: "Need an idea from earlier? Open the Ideas tab next to your work and press Add.",
  physical: "This part happens in the room. Tick off each check-in as you reach it.",
  submission: "Check your work together. Then one person submits it for the group.",
  presentation: "Your teacher chooses who presents. Think of one question to ask.",
  reflection: "What helped your group today? What would you try next time?",
};

/**
 * The centre of the lesson: the group's conversation, facilitated by Nova.
 * Everyone in the group sees Nova's messages; "Ask Nova" asks on behalf of
 * the group. (Private questions go to Pip instead.)
 */
export function NovaChat({ className }: { className?: string }) {
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

  const header = (
    <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-[#fff1e8] via-[#ffeef5] to-white px-4 py-3">
      <Buddy who="nova" size={56} mood={waiting ? "thinking" : latest ? "happy" : "idle"} />
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-xl font-bold leading-tight">Group chat with Nova</h2>
        <p className="text-sm text-ink-muted">{group.aiEnabled ? "Nova helps your group discuss · everyone sees this" : "Your teacher is facilitating directly for now"}</p>
      </div>
      {group.aiEnabled ? (
        <div className="relative shrink-0" onKeyDown={(e) => { if (e.key === "Escape") setMenu(false); }}>
          <button type="button" disabled={waiting} aria-expanded={menu} aria-haspopup="menu" aria-controls="nova-menu" onClick={() => setMenu((o) => !o)}
            className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-ink px-4 font-semibold text-white shadow-soft hover:bg-ink/85 disabled:opacity-60">
            Ask Nova<ChevronDown className="size-4" aria-hidden="true" />
          </button>
          {menu ? (
            <div id="nova-menu" role="menu" aria-label="Ask Nova as a group" className="animate-pop absolute right-0 top-12 z-30 flex w-72 flex-col gap-1 rounded-2xl border border-line bg-white p-2 shadow-lift">
              <p className="px-2 pb-1 text-sm text-ink-muted">Nova answers in this chat, for your whole group.</p>
              {GROUP_ASKS.map(([quick, label, Icon]) => (
                <button key={quick} type="button" role="menuitem" onClick={() => ask(quick)} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-medium hover:bg-[#fff1e8]">
                  <Icon className="size-5 text-[#c4420a]" aria-hidden="true" />{label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
  const empty = (
    <li className="flex items-start gap-3">
      <Nova size={40} mood="happy" />
      <div className="max-w-[85%] rounded-2xl border-2 border-[#ffd2c4] bg-[#fff6f1] px-3.5 py-2.5">
        <p className="text-xs font-semibold text-ink-muted">Nova · tip</p>
        <p>{TIPS[kind]} Talking in the room counts too.</p>
      </div>
    </li>
  );
  const after = waiting ? (
    <li className="flex items-center gap-2 text-ink-muted" role="status">
      <Nova size={34} mood="thinking" animate={false} />
      <span className="flex gap-1" aria-hidden="true"><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:200ms]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:400ms]" /></span>
      Nova is thinking…
    </li>
  ) : null;
  return <Chat className={className} header={header} empty={empty} after={after} />;
}
