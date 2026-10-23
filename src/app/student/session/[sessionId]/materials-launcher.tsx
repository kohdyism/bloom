"use client";

import { useState } from "react";
import { Dialog as RDialog } from "radix-ui";
import { BookOpen, ExternalLink, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Material = { id: string; title: string; kind: string; body: string };

/**
 * The lesson's reference materials (a poem, a source, a materials list) one
 * tap away on every stage. Opens a big reading window beside the work, so the
 * group can quote from it while they write.
 */
export function MaterialsLauncher({ materials, open, onOpenChange }: { materials: Material[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [pick, setPick] = useState(materials[0]?.id);
  if (!materials.length) return null;
  const current = materials.find((m) => m.id === pick) ?? materials[0];
  const label = materials.length === 1 ? materials[0].title : `Materials (${materials.length})`;
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <RDialog.Trigger asChild>
        <button type="button" data-tour="materials"
          className={cn("inline-flex h-9 max-w-[14rem] shrink-0 items-center gap-1.5 rounded-2xl bg-blue-soft px-2.5 text-sm font-semibold text-ink shadow-soft ring-2 ring-white hover:brightness-95 sm:h-10 sm:px-3", open && "ring-blue")}>
          <BookOpen className="size-4 shrink-0 text-blue sm:size-5" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </button>
      </RDialog.Trigger>
      <RDialog.Portal>
        <RDialog.Content
          aria-label="Lesson materials"
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => { if (!(e.target instanceof Node && (e.currentTarget as unknown as HTMLElement | null)?.contains?.(e.target))) e.preventDefault(); }}
          className={cn(
            "animate-pop fixed z-[60] flex flex-col overflow-hidden border-2 border-white bg-[#fbfcff] shadow-lift",
            "inset-x-0 bottom-0 top-[30dvh] rounded-t-[1.75rem]",
            "sm:inset-auto sm:bottom-24 sm:right-4 sm:top-28 sm:w-[min(46rem,max(26rem,48vw))] sm:rounded-[1.75rem]",
          )}
        >
          <div className="flex items-center gap-2.5 border-b border-line bg-gradient-to-r from-[#e3ecff] to-[#fbfcff] px-4 py-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue text-white" aria-hidden="true"><BookOpen className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <RDialog.Title className="truncate font-display text-lg font-bold leading-tight">{current.title}</RDialog.Title>
              <RDialog.Description className="text-sm text-ink-muted">Lesson materials — keep this open while you work.</RDialog.Description>
            </div>
            <RDialog.Close className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-2" aria-label="Close materials"><X className="size-5" /></RDialog.Close>
          </div>
          {materials.length > 1 ? (
            <div role="tablist" aria-label="Choose material" className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
              {materials.map((m) => (
                <button key={m.id} type="button" role="tab" aria-selected={m.id === current.id} onClick={() => setPick(m.id)}
                  className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold", m.id === current.id ? "bg-blue-soft text-blue" : "text-ink-muted hover:bg-surface-2")}>
                  <FileText className="size-4" aria-hidden="true" />{m.title}
                </button>
              ))}
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {current.kind === "text" ? (
              <div className="mx-auto max-w-prose whitespace-pre-line font-serif text-[1.15rem] leading-[1.75]">{current.body}</div>
            ) : (
              <a className="inline-flex items-center gap-1.5 font-semibold text-teal underline" href={`/api/materials/${current.id}`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" aria-hidden="true" />Open the file</a>
            )}
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
