"use client";

import { useState } from "react";
import { ExternalLink, FileText, Image as ImageIcon, Link2, PlayCircle } from "lucide-react";
import { safeHttpUrl, videoEmbedUrl, type StageAttachment } from "@/lib/domain/stage-media";
import { cn } from "@/lib/utils";

/**
 * Pictures, videos, links/simulations and files the teacher put into the
 * stage's instructions, shown inline with the task. Videos and embedded
 * pages load only when the student opens them.
 */
export function StageMedia({ items, className }: { items: StageAttachment[]; className?: string }) {
  if (!items.length) return null;
  return (
    <section aria-label="Media for this task" className={cn("flex flex-col gap-2", className)}>
      {items.map((a) => <MediaItem key={a.id} a={a} />)}
    </section>
  );
}

const fileUrl = (a: StageAttachment) => (a.fileId ? `/api/materials/${a.fileId}` : null);

function MediaItem({ a }: { a: StageAttachment }) {
  const [open, setOpen] = useState(false);
  const title = a.title || (a.kind === "video" ? "Video" : a.kind === "image" ? "Picture" : a.kind === "file" ? "File" : "Link");
  if (a.kind === "image") {
    const src = fileUrl(a) ?? safeHttpUrl(a.url);
    if (!src) return null;
    return (
      <figure className="overflow-hidden rounded-2xl border border-line bg-white">
        <button type="button" className="block w-full" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${title}: ${open ? "make smaller" : "make bigger"}`}>
          {/* Teacher-chosen picture: plain img so any address works. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={a.title || "Picture for the task"} className={cn("mx-auto w-auto object-contain", open ? "max-h-[70vh]" : "max-h-56")} />
        </button>
        {a.title ? <figcaption className="flex items-center gap-1.5 border-t border-line px-3 py-1.5 text-sm text-ink-muted"><ImageIcon className="size-4" aria-hidden="true" />{a.title}</figcaption> : null}
      </figure>
    );
  }
  if (a.kind === "video") {
    const embed = videoEmbedUrl(a.url);
    const link = safeHttpUrl(a.url);
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-semibold hover:bg-surface-2" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <PlayCircle className="size-5 shrink-0 text-coral" aria-hidden="true" /><span className="min-w-0 flex-1">{title}</span>
          <span className="text-sm text-teal">{open ? "Hide video" : "Watch"}</span>
        </button>
        {open && embed ? (
          <div className="aspect-video w-full bg-ink">
            <iframe src={embed} title={title} className="size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />
          </div>
        ) : null}
        {open && !embed && link ? <p className="px-3 pb-3"><a className="inline-flex items-center gap-1 font-semibold text-teal underline" href={link} target="_blank" rel="noreferrer"><ExternalLink className="size-4" aria-hidden="true" />Open the video</a></p> : null}
      </div>
    );
  }
  if (a.kind === "file") {
    const href = fileUrl(a);
    if (!href) return null;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2.5 font-semibold hover:bg-surface-2">
        <FileText className="size-5 shrink-0 text-blue" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="inline-flex items-center gap-1 text-sm text-teal">Open<ExternalLink className="size-4" aria-hidden="true" /></span>
      </a>
    );
  }
  const href = safeHttpUrl(a.url);
  if (!href) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Link2 className="size-5 shrink-0 text-purple" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-semibold">{title}</span>
        {a.embed ? <button type="button" className="text-sm font-semibold text-teal" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "Hide" : "Open here"}</button> : null}
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-teal">New tab<ExternalLink className="size-4" aria-hidden="true" /></a>
      </div>
      {a.embed && open ? (
        <div className="h-[28rem] w-full border-t border-line">
          <iframe src={href} title={title} className="size-full" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
        </div>
      ) : null}
    </div>
  );
}
