"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Nova, Pip } from "@/components/mascot";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";
import { NovaChat } from "./nova-chat";
import { PipChat } from "./pip-chat";

export type ChatTab = "group" | "pip";

/**
 * The centre of the lesson: two conversations as tabs — the group chat
 * (Nova facilitates, everyone sees it) and "Just me" (Pip, private).
 * Both stay mounted so switching never loses your place.
 */
export function ChatTabs({ tab, onTab, pipPrefill, pipTick, className, composerClassName }: {
  tab: ChatTab; onTab: (t: ChatTab) => void; pipPrefill?: { action?: string; text?: string }; pipTick: number; className?: string; composerClassName?: string;
}) {
  const { group } = useWorkspace();
  const count = group.messages.length;
  // A dot on "Group chat" when something new arrives while you're with Pip.
  const [seen, setSeen] = useState(count);
  if (tab === "group" && seen !== count) setSeen(count);
  const unread = tab !== "group" && count > seen;
  return (
    <section aria-label="Chats" className={cn("flex min-h-0 flex-col overflow-hidden rounded-[1.75rem] border-2 border-white bg-white/90 shadow-soft", className)}>
      <div role="tablist" aria-label="Chats" className="flex gap-1 border-b border-line bg-surface-2/70 p-1.5">
        <button type="button" role="tab" id="tab-group" aria-controls="panel-group" aria-selected={tab === "group"} onClick={() => onTab("group")}
          className={cn("relative inline-flex flex-1 items-center justify-center gap-2 rounded-2xl py-2 font-semibold transition", tab === "group" ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink")}>
          <Nova size={28} animate={false} mood="happy" />Group chat
          {unread ? <span className="absolute right-3 top-2 size-2.5 rounded-full bg-coral" aria-label="New messages" /> : null}
        </button>
        <button type="button" role="tab" id="tab-pip" aria-controls="panel-pip" aria-selected={tab === "pip"} onClick={() => onTab("pip")}
          className={cn("inline-flex flex-1 items-center justify-center gap-2 rounded-2xl py-2 font-semibold transition", tab === "pip" ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink")}>
          <Pip size={28} animate={false} mood="happy" />Just me · Pip<Lock className="size-4" aria-hidden="true" /><span className="sr-only">(private)</span>
        </button>
      </div>
      <div role="tabpanel" id="panel-group" aria-labelledby="tab-group" hidden={tab !== "group"} className="min-h-0 flex-1 flex-col data-[shown=true]:flex" data-shown={tab === "group"}>
        <NovaChat className="min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none" composerClassName={composerClassName} />
      </div>
      <div role="tabpanel" id="panel-pip" aria-labelledby="tab-pip" hidden={tab !== "pip"} className="min-h-0 flex-1 flex-col data-[shown=true]:flex" data-shown={tab === "pip"}>
        <PipChat active={tab === "pip"} prefill={pipPrefill} tick={pipTick} className="flex-1" composerClassName={composerClassName} />
      </div>
    </section>
  );
}
