"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, HelpCircle, Lightbulb, MessageCircleMore, Swords } from "lucide-react";
import { Buddy, useBuddy } from "@/components/buddy";
import { Bloom } from "@/components/mascot";
import { useRun } from "@/components/ui/toast";
import { useWorkspace } from "./context";
import { Chat } from "./chat";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";

type Quick = "explain_task" | "discussion_question" | "we_disagree" | "we_are_stuck";
const GROUP_ASKS: [Quick, string, React.ElementType][] = [
  ["explain_task", "Explain the task to us", HelpCircle],
  ["discussion_question", "Give us a discussion question", Lightbulb],
  ["we_disagree", "Help us with a disagreement", Swords],
  ["we_are_stuck", "We're stuck", MessageCircleMore],
];

/** Written tips (not AI) Bloom shows before it has said anything to the group. */
const TIPS: Record<string, string> = {
  orientation: "Read the task together. Can everyone say what your group will make by the end?",
  role_selection: "Pick a role that suits you — or none. Make sure the important jobs are covered.",
  brainstorm: "Quiet thinking time. Write your own idea first — nobody sees it until thinking time ends.",
  synthesis: "Your ideas are grouped into themes. Change anything that doesn't fit.",
  talk: "Screens down — talk face to face.",
  discussion: "Build on each other's ideas. Try “I agree with … because …” or “What if we …?”",
  voting: "Vote for the ideas that matter most. Then talk about the result.",
  creation: "Need an idea from earlier? Open the Ideas tab next to your work and press Add.",
  physical: "This part happens in the room. Tick off each check-in as you reach it.",
  submission: "Check your work together. Then one person submits it for the group.",
  presentation: "Your teacher chooses who presents. Think of one question to ask.",
  reflection: "What helped your group today? What would you try next time?",
};

/**
 * The centre of the lesson: the group's conversation, facilitated by Bloom.
 * Everyone in the group sees Bloom's messages; "Ask Bloom" asks on behalf of
 * the group. (Private questions go to Pip instead.)
 */
export function GroupChat({ className, composerClassName, activity, compact = false }: { className?: string; composerClassName?: string; activity?: React.ReactNode; compact?: boolean }) {
  const { group, act } = useWorkspace();
  const run = useRun();
  const kind = group.stage?.kind ?? "orientation";
  const aiMessages = group.messages.filter((m) => m.kind === "ai");
  const latest = aiMessages[aiMessages.length - 1];
  const [waiting, setWaiting] = useState(false);
  const [menu, setMenu] = useState(false);
  const buddy = useBuddy();
  const small = !useMediaQuery("(min-width: 640px)");
  const { fire, talkFor } = buddy;
  const lastSeen = useRef(latest?.id);
  useEffect(() => {
    if (latest?.id !== lastSeen.current) {
      lastSeen.current = latest?.id;
      // A new message from Bloom arrived from the server: stop "thinking", and Bloom "says" it.
      setWaiting(false);
      fire("hop");
      talkFor(2600);
    }
  }, [latest?.id, fire, talkFor]);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setWaiting(false), 20_000);
    return () => clearTimeout(t);
  }, [waiting]);
  const ask = (quick: Quick) => {
    setMenu(false);
    setWaiting(true);
    fire("nod");
    void run(() => act({ action: "ask_group_ai", quick })).then((ok) => { if (!ok) setWaiting(false); });
  };

  const header = (
    <div className={cn("flex items-center border-b border-line bg-gradient-to-r from-[#fff1e8] via-[#ffeef5] to-white", compact ? "gap-2 px-3 py-2" : "gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5")} data-tour="group-chat">
      <Buddy who="bloom" size={compact || small ? 38 : 48} mood={waiting ? "thinking" : latest ? "happy" : "idle"} cue={buddy.cue} talking={buddy.talking && !waiting} listening={buddy.listening && !waiting} />
      <div className="min-w-0 flex-1">
        <h2 className={cn("font-display font-bold leading-tight", compact ? "text-base" : "text-base sm:text-lg")}>{compact ? "Group chat" : "Group chat with Bloom"}</h2>
        <p className={cn("text-sm text-ink-muted max-sm:sr-only", compact && "sr-only")}>{group.aiEnabled ? "Bloom helps your group discuss · everyone sees this" : "Your teacher is facilitating directly for now"}</p>
      </div>
      {group.aiEnabled ? (
        <div className="relative shrink-0" onKeyDown={(e) => { if (e.key === "Escape") setMenu(false); }}>
          <button type="button" disabled={waiting} aria-expanded={menu} aria-haspopup="menu" aria-controls="bloom-menu" onClick={() => setMenu((o) => !o)}
            className={cn("inline-flex items-center gap-1.5 rounded-2xl bg-ink font-semibold text-white shadow-soft hover:bg-ink/85 disabled:opacity-60", compact ? "h-9 px-3 text-sm" : "h-9 px-3 text-sm sm:h-11 sm:px-4 sm:text-base")}>
            Ask Bloom<ChevronDown className="size-4" aria-hidden="true" />
          </button>
          {menu ? (
            <div id="bloom-menu" role="menu" aria-label="Ask Bloom as a group" className="animate-pop absolute right-0 top-12 z-30 flex w-72 flex-col gap-1 rounded-2xl border border-line bg-white p-2 shadow-lift">
              <p className="px-2 pb-1 text-sm text-ink-muted">Bloom answers in this chat, for your whole group.</p>
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
      <Bloom size={40} mood="happy" />
      <div className="max-w-[85%] rounded-2xl border-2 border-[#ffd2c4] bg-[#fff6f1] px-3.5 py-2.5">
        <p className="text-xs font-semibold text-ink-muted">Bloom · tip</p>
        <p>{TIPS[kind]} Talking in the room counts too.</p>
      </div>
    </li>
  );
  const after = waiting ? (
    <li className="flex items-center gap-2 text-ink-muted" role="status">
      <span className="buddy-chatter block"><Bloom size={34} mood="thinking" /></span>
      <span className="flex gap-1" aria-hidden="true"><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:200ms]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:400ms]" /></span>
      Bloom is thinking…
    </li>
  ) : null;
  return <Chat className={className} header={header} empty={empty} after={after} composerClassName={composerClassName} compact={compact}
    inline={activity ? { node: activity, after: group.stageStartedAt, key: `task-${group.stageIndex}-${group.stageStatus === "complete" ? "done" : "on"}` } : undefined}
    onActivity={(e) => (e === "typing" ? buddy.listen() : fire("nod"))} />;
}
