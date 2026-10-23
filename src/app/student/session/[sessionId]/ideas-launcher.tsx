"use client";

import { Dialog as RDialog } from "radix-ui";
import { Lightbulb, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";
import { IdeaBank } from "./idea-bank";

/**
 * While the group makes its output, its ideas are a dock button (like Group
 * chat and Pip) that opens a big floating window: easy to read and refer to,
 * with the work still visible and usable beside it, so "Add" can drop an idea
 * straight in.
 */
export function IdeasLauncher({ open, onOpenChange, compact = false }: { open: boolean; onOpenChange: (o: boolean) => void; compact?: boolean }) {
  const { group } = useWorkspace();
  const count = group.ideas.shared.length;
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <RDialog.Trigger asChild>
        <button type="button" data-tour="ideas-tab"
          className={cn("relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-2xl bg-sun-soft px-2.5 text-sm font-semibold sm:h-10 sm:px-3 sm:text-base text-ink shadow-soft ring-2 ring-white hover:brightness-95", open && "ring-amber")}>
          <Lightbulb className="size-5 text-amber" aria-hidden="true" />
          <span className={compact ? "sr-only" : undefined}>Our ideas</span>
          <span className="min-w-5 rounded-full bg-sun px-1.5 text-center text-xs font-bold" aria-label={`${count} ideas`}>{count}</span>
        </button>
      </RDialog.Trigger>
      <RDialog.Portal>
        <RDialog.Content
          aria-label="Our group's ideas"
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          // Escape while typing in the work (e.g. a sticky note) shouldn't close the ideas.
          onEscapeKeyDown={(e) => { if (!(e.target instanceof Node && (e.currentTarget as unknown as HTMLElement | null)?.contains?.(e.target))) e.preventDefault(); }}
          className={cn(
            "animate-pop fixed z-[60] flex flex-col overflow-hidden border-2 border-white bg-[#fffdf6] shadow-lift",
            // Phones: a tall sheet (about two-thirds of the screen) with the work peeking above.
            "inset-x-0 bottom-0 top-[30dvh] rounded-t-[1.75rem]",
            // Bigger screens: about half the screen on the right, between header and dock.
            "sm:inset-auto sm:bottom-24 sm:right-4 sm:top-28 sm:w-[min(46rem,max(26rem,48vw))] sm:rounded-[1.75rem]",
          )}
        >
          <div className="flex items-center gap-2.5 border-b border-line bg-gradient-to-r from-[#fff5d6] to-[#fffdf6] px-4 py-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-sun" aria-hidden="true"><Lightbulb className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <RDialog.Title className="font-display text-lg font-bold leading-tight">Our group&apos;s ideas</RDialog.Title>
              <RDialog.Description className="text-sm text-ink-muted">Everything your group came up with. Press Add to put one into your work.</RDialog.Description>
            </div>
            <RDialog.Close className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-2" aria-label="Close ideas"><X className="size-5" /></RDialog.Close>
          </div>
          <div className="ideas-window flex min-h-0 flex-1 flex-col text-[1.05rem]"><IdeaBank /></div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
