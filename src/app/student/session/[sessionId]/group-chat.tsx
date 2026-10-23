"use client";

import { useEffect, useRef, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { Bloom } from "@/components/mascot";
import { cn } from "@/lib/utils";
import { mentionsHelper } from "@/lib/domain/mentions";
import { useWorkspace } from "./context";
import { Chat } from "./chat";

/**
 * The group's written conversation. It's the main space in Discussion
 * stages, and one tap away (in the dock) the rest of the time. Bloom speaks
 * from the top of the task, but joins the chat when someone types "@Bloom".
 */
export function GroupChat({ className, compact = false, onClose }: { className?: string; compact?: boolean; onClose?: React.ReactNode }) {
  const { group } = useWorkspace();
  const discussion = group.stage?.kind === "discussion";
  const aiMessages = group.messages.filter((m) => m.kind === "ai");
  const latest = aiMessages[aiMessages.length - 1];
  const [waiting, setWaiting] = useState(false);
  const lastSeen = useRef(latest?.id);
  useEffect(() => {
    if (latest?.id === lastSeen.current) return;
    lastSeen.current = latest?.id;
    // Bloom's reply arrived from the server.
     
    setWaiting(false);
  }, [latest?.id]);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setWaiting(false), 25_000);
    return () => clearTimeout(t);
  }, [waiting]);

  const header = (
    <div className={cn("flex items-center gap-2.5 border-b border-line bg-gradient-to-r from-[#eaf8f4] to-white", compact ? "px-3 py-2" : "px-4 py-2.5")} data-tour="group-chat">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal-strong" aria-hidden="true"><MessagesSquare className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-bold leading-tight sm:text-lg">Group chat</h2>
        <p className="truncate text-xs text-ink-muted sm:text-sm">{discussion && group.aiEnabled ? "Talk with your group · type @Bloom to ask Bloom" : "Everyone in your group sees this"}</p>
      </div>
      {onClose}
    </div>
  );
  const empty = (
    <li className="flex items-center gap-3 text-sm text-ink-muted"><Bloom size={36} mood="happy" />No messages yet. Writing here is optional — talking in the room counts too.</li>
  );
  const after = waiting ? (
    <li className="flex items-center gap-2 text-ink-muted" role="status">
      <span className="buddy-chatter block"><Bloom size={34} mood="thinking" /></span>
      <span className="flex gap-1" aria-hidden="true"><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:200ms]" /><span className="animate-pulse-dot size-2 rounded-full bg-[#ff7f6e] [animation-delay:400ms]" /></span>
      Bloom is thinking…
    </li>
  ) : null;
  return (
    <Chat className={className} header={header} empty={empty} after={after} compact={compact}
      placeholder={discussion && group.aiEnabled ? "Message your group, or @Bloom…" : "Message your group…"}
      onActivity={(e, t) => { if (e === "sent" && t && discussion && mentionsHelper(t) && group.aiEnabled) setWaiting(true); }} />
  );
}
