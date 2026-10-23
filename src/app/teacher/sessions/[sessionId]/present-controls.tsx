"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { SubmissionView, type SubmissionContent } from "@/components/live/submission-view";
import { cn } from "@/lib/utils";

type Pres = { submissionId: string; view: string; slide: number };

/**
 * What the class is seeing right now, with back/next. Moves show here straight
 * away; the shared slide wins as soon as it changes (from here, the classroom
 * screen or the presenting group).
 */
export function PresentControls({ sessionId, p, onSlide }: { sessionId: string; p: Pres; onSlide: (n: number) => void }) {
  const { data } = useLiveState<{ content: SubmissionContent }>({ url: `/api/live/teacher/${sessionId}/submissions/${p.submissionId}`, channels: [] });
  const content = data?.content;
  const total = p.view === "slides" ? content?.slides?.slides.length ?? 0 : 0;
  const [local, setLocal] = useState<{ slide: number; base: number } | null>(null);
  if (local && local.base !== p.slide) setLocal(null);
  const slide = Math.min(local ? local.slide : p.slide, Math.max(0, total - 1));
  const go = (n: number) => {
    if (!total) return;
    const next = Math.max(0, Math.min(total - 1, n));
    if (next === slide) return;
    setLocal({ slide: next, base: p.slide });
    onSlide(next);
  };
  return (
    <div className="flex flex-wrap items-center gap-4"
      onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); go(slide + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(slide - 1); } }}>
      <div className="max-h-72 w-full max-w-sm overflow-auto rounded-xl border border-line bg-white" aria-label="What the class sees now">
        {content ? <SubmissionView content={content} view={p.view} slide={slide} onSlide={go} mediaUrl={(id) => `/api/media/${id}`} controls={false} bare /> : <p className="p-6 text-sm text-ink-muted">Loading…</p>}
      </div>
      {total > 0 ? (
        <div className="flex items-center gap-2" role="group" aria-label="Move the slides">
          <button type="button" onClick={() => go(slide - 1)} disabled={slide === 0} aria-label="Previous slide"
            className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface-2 hover:bg-line disabled:opacity-40"><ChevronLeft className="size-7" /></button>
          <span className="min-w-24 text-center font-display text-lg font-semibold tabular-nums">Slide {slide + 1} of {total}</span>
          <button type="button" onClick={() => go(slide + 1)} disabled={slide >= total - 1} aria-label="Next slide"
            className={cn("inline-flex size-12 items-center justify-center rounded-2xl bg-coral text-white hover:brightness-95 disabled:opacity-40")}><ChevronRight className="size-7" /></button>
        </div>
      ) : <p className="text-sm text-ink-muted">This view has no slides to move through.</p>}
    </div>
  );
}
