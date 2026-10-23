"use client";

import { useState } from "react";
import { SubmissionView, VIEW_LABELS, type SubmissionContent } from "@/components/live/submission-view";
import { cn } from "@/lib/utils";

/** The group's final submitted work, read-only, with a tab per part. */
export function PastWork({ content, note }: { content: SubmissionContent; note?: string }) {
  const kinds = content.kinds ?? [];
  const [view, setView] = useState(kinds[0]);
  return (
    <div className="flex flex-col gap-3">
      {kinds.length > 1 ? (
        <div role="tablist" aria-label="Which part" className="flex w-fit gap-1 rounded-xl bg-surface-2 p-1">
          {kinds.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
              className={cn("rounded-lg px-3 py-1 text-sm font-semibold", view === k ? "bg-white shadow-soft" : "text-ink-muted hover:text-ink")}>{VIEW_LABELS[k] ?? k}</button>
          ))}
        </div>
      ) : null}
      <SubmissionView content={content} view={view} mediaUrl={(id) => `/api/media/${id}`} note={note} />
    </div>
  );
}
