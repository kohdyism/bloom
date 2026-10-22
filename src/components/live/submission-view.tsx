"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SLIDE_H, SLIDE_W, type BoardObject, type SlideData } from "@/lib/domain/artifact-model";
import { BoardView, boardBounds, boardOutline } from "@/components/board/board-object";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SubmissionContent = {
  kinds?: string[];
  document?: { html: string; text: string };
  whiteboard?: { objects: BoardObject[] };
  slides?: { slides: SlideData[] };
  media?: { id: string; caption: string; mimeType: string }[];
};

/**
 * Read-only view of a submitted snapshot. The document HTML was produced by
 * the server's escaping serializer (never by a client), so it's safe to render.
 */
export function SubmissionView({
  content, view, slide, onSlide, mediaUrl, large, note, controls = true,
}: {
  content: SubmissionContent; view?: string; slide?: number; onSlide?: (n: number) => void; mediaUrl: (id: string) => string; large?: boolean; note?: string; controls?: boolean;
}) {
  const kinds = content.kinds ?? [];
  const [local, setLocal] = useState(0);
  const current = slide ?? local;
  const setSlide = onSlide ?? setLocal;
  const v = view && kinds.includes(view) ? view : kinds[0];
  if (!v) return <p className="text-ink-muted">{note ? note : "This submission is empty."}</p>;

  if (v === "slides" && content.slides) {
    const slides = content.slides.slides;
    const s = slides[Math.min(current, slides.length - 1)];
    return (
      <div className="flex flex-col gap-3">
        <div className={cn("overflow-hidden rounded-xl border border-line bg-white shadow-soft", large && "rounded-2xl")}>
          {s ? <BoardView objects={s.objects} viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`} mediaUrl={mediaUrl} className="block h-auto w-full" title={`Slide ${current + 1} of ${slides.length}`} /> : null}
        </div>
        <div className={cn("flex items-center gap-3", controls ? "justify-between" : "justify-center")}>
          {controls ? <Button variant="secondary" size="sm" onClick={() => setSlide(Math.max(0, current - 1))} disabled={current === 0} aria-label="Previous slide"><ChevronLeft /></Button> : null}
          <span className="text-sm font-semibold" aria-live="polite">Slide {Math.min(current + 1, slides.length)} of {slides.length}</span>
          {controls ? <Button variant="secondary" size="sm" onClick={() => setSlide(Math.min(slides.length - 1, current + 1))} disabled={current >= slides.length - 1} aria-label="Next slide"><ChevronRight /></Button> : null}
        </div>
        {s ? <details className="text-sm text-ink-muted"><summary className="cursor-pointer">Slide text</summary><ul className="mt-1 list-disc pl-5">{boardOutline(s.objects).map((t, i) => <li key={i}>{t}</li>)}</ul></details> : null}
      </div>
    );
  }
  if (v === "whiteboard" && content.whiteboard) {
    const objs = content.whiteboard.objects;
    return (
      <div className="flex flex-col gap-2">
        <div className="overflow-hidden rounded-xl border border-line bg-[radial-gradient(var(--line)_1px,transparent_1px)] bg-[length:22px_22px] bg-white">
          <BoardView objects={objs} viewBox={boardBounds(objs)} mediaUrl={mediaUrl} className={cn("block h-auto w-full", large ? "max-h-[75dvh]" : "max-h-[60dvh]")} title="Group whiteboard" />
        </div>
        <details className="text-sm text-ink-muted"><summary className="cursor-pointer">Board text</summary><ul className="mt-1 list-disc pl-5">{boardOutline(objs).map((t, i) => <li key={i}>{t}</li>)}</ul></details>
      </div>
    );
  }
  if (v === "document" && content.document) {
    return <div className={cn("bloom-prose max-w-none rounded-xl border border-line bg-white p-6", large && "text-xl leading-relaxed")} dangerouslySetInnerHTML={{ __html: content.document.html }} />;
  }
  if (v === "media" && content.media) {
    return (
      <ul className="grid gap-4 sm:grid-cols-2">
        {content.media.map((m) => (
          <li key={m.id} className="overflow-hidden rounded-xl border border-line bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(m.id)} alt={m.caption || "Photo of the group's work"} className="h-auto w-full" />
            {m.caption ? <p className="p-3 text-sm">{m.caption}</p> : null}
          </li>
        ))}
      </ul>
    );
  }
  return <p className="text-ink-muted">Nothing to show in this view.</p>;
}

export const VIEW_LABELS: Record<string, string> = { document: "Document", whiteboard: "Whiteboard", slides: "Slides", media: "Photos" };
