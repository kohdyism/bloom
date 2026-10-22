"use client";

import { useState } from "react";
import { Dialog as RDialog } from "radix-ui";
import { Lock, X } from "lucide-react";
import { Pip } from "@/components/mascot";
import { cn } from "@/lib/utils";
import { PipChat } from "./pip-chat";

/**
 * Pip lives in the corner of the dock. Tap Pip to open a private chat window
 * (a floating panel on bigger screens, a sheet on phones). It doesn't block the
 * lesson: the task and group chat stay usable while Pip is open.
 */
export function PipLauncher({ open, onOpenChange, prefill, tick, compact = false }: {
  open: boolean; onOpenChange: (o: boolean) => void; prefill?: { action?: string; text?: string }; tick: number; compact?: boolean;
}) {
  // A dot when Pip has something new (e.g. a gentle private nudge) while closed.
  const [seenTick, setSeenTick] = useState(tick);
  if (open && seenTick !== tick) setSeenTick(tick);
  const unread = !open && tick !== seenTick;

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <RDialog.Trigger asChild>
        <button
          type="button"
          data-tour="pip"
          className={cn("group relative flex shrink-0 items-center gap-1.5 rounded-full bg-purple-soft py-1 pl-1 font-semibold text-purple-strong shadow-soft ring-2 ring-white transition hover:-translate-y-0.5 hover:brightness-95", compact ? "pr-1" : "pr-3.5", open && "ring-purple")}
        >
          <span key={unread ? `u${tick}` : "still"} className={cn("block", unread && "buddy-hop")}><Pip size={compact ? 44 : 50} mood={open ? "listening" : unread ? "happy" : "idle"} /></span>
          {compact ? <span className="sr-only">Ask Pip (private)</span> : <span className="flex flex-col items-start leading-tight"><span>Ask Pip<span className="sr-only"> (private)</span></span><span className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-wide text-purple" aria-hidden="true"><Lock className="size-3" />Just you</span></span>}
          {unread ? <span className="absolute right-0.5 top-0.5 size-3 rounded-full border-2 border-white bg-coral" aria-label="Pip has something for you" /> : null}
        </button>
      </RDialog.Trigger>
      <RDialog.Portal>
        <RDialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById("assistant-input")?.focus(); }}
          className={cn(
            "animate-pop fixed z-[60] flex flex-col overflow-hidden border-2 border-white bg-white shadow-lift",
            "inset-x-0 bottom-0 top-[8dvh] rounded-t-[1.75rem]",
            "sm:inset-auto sm:bottom-24 sm:right-4 sm:top-auto sm:h-[min(40rem,calc(100dvh-8rem))] sm:w-[26rem] sm:rounded-[1.75rem]",
          )}
        >
          <RDialog.Title className="sr-only">Pip, your private helper</RDialog.Title>
          <RDialog.Description className="sr-only">Only you see this conversation.</RDialog.Description>
          <RDialog.Close className="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-2" aria-label="Close Pip">
            <X className="size-5" />
          </RDialog.Close>
          <PipChat active={open} prefill={prefill} tick={tick} className="min-h-0 flex-1" />
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
