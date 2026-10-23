"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { SLIDE_H, SLIDE_W } from "@/lib/domain/artifact-model";
import { BoardView, boardBounds } from "@/components/board/board-object";
import type { SubmissionContent } from "@/components/live/submission-view";
import { Button } from "@/components/ui/button";

type Work = { content: SubmissionContent; version: number; submittedAt: string | null; groupName: string; title: string; members: string[] };

/**
 * Every part of the work laid out for paper: each slide on its own landscape
 * page, then the document, the whiteboard and photos. Opens the print dialog
 * once images have loaded, where "Save as PDF" makes the file.
 */
export function PrintWork({ work, part, back }: { work: Work; part?: string; back: string }) {
  const c = work.content;
  const kinds = (c.kinds ?? []).filter((k) => !part || k === part);
  const mediaUrl = (id: string) => `/api/media/${id}`;
  useEffect(() => {
    const imgs = [...document.images];
    const loaded = Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    const t = setTimeout(() => void loaded.then(() => window.print()), 400);
    return () => clearTimeout(t);
  }, []);
  const onlySlides = kinds.length === 1 && kinds[0] === "slides";
  return (
    <div className="print-work mx-auto w-full max-w-5xl bg-white px-6 py-6 text-ink print:max-w-none print:p-0">
      {/* Slides print edge to edge on landscape pages; other parts on portrait. */}
      <style>{`@media print { @page { size: ${onlySlides ? "A4 landscape" : "A4"}; margin: ${onlySlides ? "0" : "14mm"}; } body { background: white !important; } [data-demo-banner] { display: none; } .slide-page { break-after: page; } .slide-page:last-child { break-after: auto; } }`}</style>
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Button asChild variant="ghost"><Link href={back}><ArrowLeft />Back</Link></Button>
        <p className="flex-1 text-sm text-ink-muted">In the print window, choose <strong>Save as PDF</strong> as the printer.</p>
        <Button onClick={() => window.print()}><Printer />Print or save as PDF</Button>
      </div>
      {!onlySlides ? (
        <header className="mb-6">
          <h1 className="font-display text-3xl font-bold">{work.title}</h1>
          <p className="text-ink-muted">Group {work.groupName} · {work.members.join(", ")}{work.submittedAt ? ` · ${new Date(work.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}</p>
        </header>
      ) : null}
      {kinds.includes("slides") && c.slides ? (
        <section aria-label="Slides" className="flex flex-col gap-6 print:gap-0">
          {c.slides.slides.map((s, i) => (
            <div key={i} className={onlySlides ? "slide-page flex h-auto items-center justify-center print:h-[100vh]" : "slide-page mb-4"}>
              <BoardView objects={s.objects} viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`} mediaUrl={mediaUrl} title={`Slide ${i + 1}`} className="block h-auto w-full rounded-xl border border-line print:max-h-[100vh] print:rounded-none print:border-0" />
            </div>
          ))}
        </section>
      ) : null}
      {kinds.includes("document") && c.document ? (
        <section aria-label="Document" className="bloom-prose mb-6 max-w-none" dangerouslySetInnerHTML={{ __html: c.document.html }} />
      ) : null}
      {kinds.includes("whiteboard") && c.whiteboard ? (
        <section aria-label="Whiteboard" className="mb-6 break-inside-avoid">
          <h2 className="mb-2 font-display text-xl font-semibold">Whiteboard</h2>
          <BoardView objects={c.whiteboard.objects} viewBox={boardBounds(c.whiteboard.objects)} mediaUrl={mediaUrl} title="Group whiteboard" className="block h-auto max-h-[80vh] w-full rounded-xl border border-line" />
        </section>
      ) : null}
      {kinds.includes("media") && c.media?.length ? (
        <section aria-label="Photos" className="grid grid-cols-2 gap-4">
          {c.media.map((m) => (
            <figure key={m.id} className="break-inside-avoid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(m.id)} alt={m.caption || "Photo of the group's work"} className="h-auto w-full rounded-xl" />
              {m.caption ? <figcaption className="mt-1 text-sm">{m.caption}</figcaption> : null}
            </figure>
          ))}
        </section>
      ) : null}
    </div>
  );
}
