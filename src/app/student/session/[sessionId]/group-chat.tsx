"use client";

import { MessagesSquare } from "lucide-react";
import { Bloom } from "@/components/mascot";
import { cn } from "@/lib/utils";
import { Chat } from "./chat";

/**
 * The group's written conversation — for people. It sits beside the task in
 * Discussion stages and is one tap away (in the dock) the rest of the time.
 */
// Bloom answers in its own panel and the header shows the stage, so the chat skips those lines.
const notBloom = (m: { kind: string; body: string }) => m.kind !== "ai" && !(m.kind === "system" && m.body.startsWith("Stage complete"));

export function GroupChat({ className, compact = false, onClose, top }: { className?: string; compact?: boolean; onClose?: React.ReactNode; top?: React.ReactNode }) {
  const header = (
    <div className={cn("flex items-center gap-2.5 border-b border-line bg-gradient-to-r from-[#eaf8f4] to-white", compact ? "px-3 py-2" : "px-4 py-2.5")} data-tour="group-chat">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal-strong" aria-hidden="true"><MessagesSquare className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-bold leading-tight sm:text-lg">Group chat</h2>
        <p className="truncate text-xs text-ink-muted sm:text-sm">Everyone in your group sees this</p>
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
      placeholder="Message your group…"
 />
  );
}
