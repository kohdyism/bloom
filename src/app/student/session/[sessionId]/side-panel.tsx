"use client";

import { useEffect, useRef } from "react";
import { Lightbulb, MessagesSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IdeaBank } from "./idea-bank";
import { Chat } from "./chat";

export type PanelTab = "ideas" | "chat";

/**
 * Ideas and chat, side by side with the activity (not on top of it) on wide
 * screens, so students can read and copy ideas while they write. On small
 * screens it slides over the page. Non-modal: the activity stays usable.
 */
export function SidePanel({ tab, tabs, onTab, onClose, overlay }: {
  tab: PanelTab; tabs: PanelTab[]; onTab: (t: PanelTab) => void; onClose: () => void; overlay: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const meta = { ideas: { label: "Ideas", icon: Lightbulb }, chat: { label: "Group chat", icon: MessagesSquare } } as const;
  return (
    <aside
      aria-labelledby="side-panel-title"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      className={cn(
        "panel-in flex min-h-0 flex-col overflow-hidden border-2 border-white bg-white/95 shadow-lift",
        overlay ? "fixed inset-y-0 right-0 z-40 w-full max-w-md" : "w-[24rem] shrink-0 rounded-[1.75rem] 2xl:w-[27rem]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <h2 id="side-panel-title" ref={headingRef} tabIndex={-1} className="sr-only">{meta[tab].label}</h2>
        <div role="tablist" aria-label="Side panel" className="flex flex-1 gap-1 rounded-2xl bg-surface-2 p-1">
          {tabs.map((t) => {
            const Icon = meta[t].icon;
            return (
              <button key={t} type="button" role="tab" aria-selected={tab === t} aria-controls={`panel-${t}`} id={`tab-${t}`} onClick={() => onTab(t)}
                className={cn("inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 font-semibold transition", tab === t ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink")}>
                <Icon className="size-5" aria-hidden="true" />{meta[t].label}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onClose} className="inline-flex size-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-2" aria-label="Close panel"><X className="size-5" /></button>
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
        {tab === "ideas" ? <IdeaBank /> : <Chat className="flex-1 rounded-none border-0 bg-transparent shadow-none" />}
      </div>
    </aside>
  );
}
