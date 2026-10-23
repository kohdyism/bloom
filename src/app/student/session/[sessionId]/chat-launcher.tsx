"use client";

import { useState } from "react";
import { Dialog as RDialog } from "radix-ui";
import { MessagesSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";
import { GroupChat } from "./group-chat";

/**
 * Outside Discussion stages the group chat is tucked into the dock: a button
 * with a count of new messages that opens the chat in a floating window. The
 * task stays visible and usable behind it.
 */
export function ChatLauncher({ open, onOpenChange, compact = false }: { open: boolean; onOpenChange: (o: boolean) => void; compact?: boolean }) {
  const { group, state } = useWorkspace();
  const fromOthers = group.messages.filter((m) => (m.kind === "student" || m.kind === "teacher") && m.authorId !== state.me.id).length;
  const [seen, setSeen] = useState(fromOthers);
  if (open && seen !== fromOthers) setSeen(fromOthers);
  const unread = open ? 0 : Math.max(0, fromOthers - seen);

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <RDialog.Trigger asChild>
        <button type="button" data-tour="chat-button"
          className={cn("relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-teal-soft px-3 font-semibold text-teal-strong shadow-soft ring-2 ring-white hover:brightness-95", open && "ring-teal")}>
          <MessagesSquare className="size-5" aria-hidden="true" />
          <span className={compact ? "sr-only" : undefined}>Group chat</span>
          {unread ? <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-white bg-coral px-1 text-center text-xs font-bold text-white">{unread}<span className="sr-only"> new</span></span> : null}
        </button>
      </RDialog.Trigger>
      <RDialog.Portal>
        <RDialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById("chat-input")?.focus(); }}
          className={cn(
            "animate-pop fixed z-[60] flex flex-col overflow-hidden rounded-t-[1.75rem] border-2 border-white bg-white shadow-lift",
            "inset-x-0 bottom-0 top-[8dvh]",
            "sm:inset-auto sm:bottom-24 sm:left-4 sm:top-auto sm:h-[min(38rem,calc(100dvh-8rem))] sm:w-[25rem] sm:rounded-[1.75rem]",
          )}
        >
          <RDialog.Title className="sr-only">Group chat</RDialog.Title>
          <RDialog.Description className="sr-only">Everyone in your group sees this conversation.</RDialog.Description>
          <GroupChat compact className="min-h-0 flex-1 rounded-none border-0 shadow-none"
            onClose={<RDialog.Close className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-2" aria-label="Close group chat"><X className="size-5" /></RDialog.Close>} />
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
