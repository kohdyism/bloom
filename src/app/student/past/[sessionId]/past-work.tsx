"use client";

import { useState } from "react";
import { SubmissionView, VIEW_LABELS, type SubmissionContent } from "@/components/live/submission-view";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

/** The group's final submitted work, read-only, with a tab per part. */
export function PastWork({ content, note, id }: { content: SubmissionContent; note?: string; id: string }) {
  const kinds = content.kinds ?? [];
  const [view, setView] = useState(kinds[0]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
      {kinds.length > 1 ? (
        <div role="tablist" aria-label="Which part" className="flex w-fit gap-1 rounded-xl bg-surface-2 p-1">
          {kinds.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
              className={cn("rounded-lg px-3 py-1 text-sm font-semibold", view === k ? "bg-white shadow-soft" : "text-ink-muted hover:text-ink")}>{VIEW_LABELS[k] ?? k}</button>
          ))}
        </div>
      ) : null}
        <a href={`/print/${id}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-teal hover:bg-teal-soft"><Download className="size-4" aria-hidden="true" />Save as PDF</a>
      </div>
      <SubmissionView content={content} view={view} mediaUrl={(id) => `/api/media/${id}`} note={note} />
    </div>
  );
}
