"use client";

import { MessagesSquare } from "lucide-react";
import { Bloom } from "@/components/mascot";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";
import { Chat } from "./chat";

/**
 * The group's written conversation — for people. It sits beside the task in
 * Discussion stages and is one tap away (in the dock) the rest of the time.
 * Typing "@Bloom" in Discussion asks Bloom, which answers in its own panel.
 */
// Bloom speaks from its own panel, so its words aren't repeated in the chat.
const notBloom = (m: { kind: string }) => m.kind !== "ai";

export function GroupChat({ className, compact = false, onClose, top }: { className?: string; compact?: boolean; onClose?: React.ReactNode; top?: React.ReactNode }) {
  const { group } = useWorkspace();
  const discussion = group.stage?.kind === "discussion";
  const header = (
    <div className={cn("flex items-center gap-2.5 border-b border-line bg-gradient-to-r from-[#eaf8f4] to-white", compact ? "px-3 py-2" : "px-4 py-2.5")} data-tour="group-chat">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal-strong" aria-hidden="true"><MessagesSquare className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-bold leading-tight sm:text-lg">Group chat</h2>
        <p className="truncate text-xs text-ink-muted sm:text-sm">{discussion && group.aiEnabled ? "Type @Bloom to ask Bloom — it answers in its panel" : "Everyone in your group sees this"}</p>
      </div>
      {onClose}
    </div>
  );
  const fullHeader = <>{header}{top}</>;
  const empty = (
    <li className="flex items-center gap-3 text-sm text-ink-muted"><Bloom size={36} mood="happy" />No messages yet. Writing here is optional — talking in the room counts too.</li>
  );
  return (
    <Chat className={className} header={fullHeader} empty={empty} compact={compact} show={notBloom}
      placeholder={discussion && group.aiEnabled ? "Message your group, or @Bloom…" : "Message your group…"}
 />
  );
}
