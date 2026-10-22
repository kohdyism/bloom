"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { ArrowDown, ArrowUp, Maximize, Plus, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { SLIDE_H, SLIDE_W, layoutObjects, makeObjectMap, readSlides, type SlideLayout } from "@/lib/domain/artifact-model";
import { BoardView } from "@/components/board/board-object";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BoardCanvas, type InsertText } from "./board-canvas";
import { useYDoc, SaveIndicator } from "./use-ydoc";

const LAYOUTS: { value: SlideLayout; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "title_body", label: "Title and points" },
  { value: "two_column", label: "Two columns" },
  { value: "image_caption", label: "Image and caption" },
  { value: "blank", label: "Blank" },
];
const newId = () => Math.random().toString(36).slice(2, 10);

function useSlides(arr: Y.Array<Y.Map<unknown>>) {
  const cache = useRef<{ v: number; data: ReturnType<typeof readSlides> }>({ v: -1, data: [] });
  const v = useRef(0);
  const sub = useCallback((cb: () => void) => { const h = () => { v.current++; cb(); }; arr.observeDeep(h); return () => arr.unobserveDeep(h); }, [arr]);
  const get = useCallback(() => { if (cache.current.v !== v.current) cache.current = { v: v.current, data: readSlides(arr) }; return cache.current.data; }, [arr]);
  return useSyncExternalStore(sub, get, get);
}

/** Lightweight collaborative slides built on the same object engine as the whiteboard. */
export function SlidesEditor({ artifactId, readOnly, uploadImage, onInserter }: { artifactId: string; readOnly?: boolean; uploadImage?: (f: File) => Promise<string | null>; onInserter?: (f: InsertText | null) => void }) {
  const { doc, status, loaded } = useYDoc(artifactId, { readOnly });
  const arr = doc.getArray("slides") as Y.Array<Y.Map<unknown>>;
  const slides = useSlides(arr);
  const [current, setCurrent] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const idx = Math.min(current, Math.max(0, slides.length - 1));
  const ro = readOnly || status === "readonly";

  const addSlide = (layout: SlideLayout) => {
    const m = new Y.Map<unknown>();
    const objs = new Y.Map<Y.Map<unknown>>();
    const before = slides[idx]?.order ?? -1;
    const after = slides[idx + 1]?.order ?? before + 2;
    doc.transact(() => {
      m.set("id", newId());
      m.set("layout", layout);
      m.set("order", slides.length ? (before + after) / 2 : 0);
      m.set("objects", objs);
      for (const o of layoutObjects(layout, newId)) objs.set(o.id, makeObjectMap(o) as Y.Map<unknown>);
      arr.push([m]);
    }, "local-edit");
    setCurrent(slides.length ? idx + 1 : 0);
  };

  /** Swap the order values of two neighbouring slides. */
  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= slides.length) return;
    const a = slides[from];
    const b = slides[to];
    doc.transact(() => {
      arr.get(a.index).set("order", b.order);
      arr.get(b.index).set("order", a.order === b.order ? b.order + (to > from ? 0.5 : -0.5) : a.order);
    }, "local-edit");
    setCurrent(to);
  };

  const removeSlide = (i: number) => {
    if (!window.confirm("Delete this slide for everyone in your group?")) return;
    doc.transact(() => arr.delete(slides[i].index, 1), "local-edit");
    setCurrent(Math.max(0, i - 1));
  };

  const slideMap = slides[idx] ? (arr.get(slides[idx].index)?.get("objects") as Y.Map<Y.Map<unknown>> | undefined) : undefined;

  return (
    <div className="flex flex-col gap-3" data-testid="slides-editor">
      <div className="flex flex-wrap items-center gap-2">
        {!ro ? (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-sm font-semibold">Add slide:</span>
            {LAYOUTS.map((l) => <Button key={l.value} size="sm" variant="secondary" onClick={() => addSlide(l.value)}><Plus />{l.label}</Button>)}
          </div>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          <SaveIndicator status={readOnly ? "readonly" : status} />
          <Button size="sm" variant="soft" disabled={!slides.length} onClick={() => setPresenting(true)}><Maximize />Preview</Button>
        </span>
      </div>
      {!slides.length ? (
        <div className="rounded-2xl border border-dashed border-line-strong p-10 text-center text-ink-muted">{loaded ? (ro ? "No slides." : "No slides yet — add one with a layout above.") : "Loading…"}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[9rem_minmax(0,1fr)]">
          <ol className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible" aria-label="Slides">
            {slides.map((s, i) => (
              <li key={s.id} className="shrink-0">
                <button type="button" onClick={() => setCurrent(i)} aria-current={i === idx ? "true" : undefined} aria-label={`Slide ${i + 1}`}
                  className={cn("block w-32 overflow-hidden rounded-lg border-2 bg-white md:w-full", i === idx ? "border-teal" : "border-line")}>
                  <BoardView objects={s.objects} viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`} mediaUrl={(id) => `/api/media/${id}`} className="pointer-events-none block h-auto w-full" title={`Slide ${i + 1} thumbnail`} />
                </button>
                {!ro && i === idx ? (
                  <div className="mt-1 flex justify-center gap-0.5">
                    <button className="rounded p-1 text-ink-muted hover:bg-surface-2" aria-label="Move slide earlier" onClick={() => moveSlide(i, i - 1)} disabled={i === 0}><ArrowUp className="size-3.5" /></button>
                    <button className="rounded p-1 text-ink-muted hover:bg-surface-2" aria-label="Move slide later" onClick={() => moveSlide(i, i + 1)} disabled={i === slides.length - 1}><ArrowDown className="size-3.5" /></button>
                    <button className="rounded p-1 text-coral hover:bg-coral-soft" aria-label="Delete slide" onClick={() => removeSlide(i)}><Trash2 className="size-3.5" /></button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          {slideMap ? <BoardCanvas key={slides[idx]?.id} doc={doc} map={slideMap} width={SLIDE_W} height={SLIDE_H} readOnly={ro} mediaUrl={(id) => `/api/media/${id}`} uploadImage={uploadImage} label={`Slide ${idx + 1}`} background="white" onInserter={onInserter} insertAs="text" /> : null}
        </div>
      )}
      {presenting ? <FullscreenSlides slides={slides} start={idx} onClose={() => setPresenting(false)} /> : null}
    </div>
  );
}

/** Full-screen slide preview with keyboard navigation. */
export function FullscreenSlides({ slides, start, onClose, mediaUrl = (id: string) => `/api/media/${id}` }: { slides: ReturnType<typeof readSlides>; start: number; onClose: () => void; mediaUrl?: (id: string) => string }) {
  const [i, setI] = useState(start);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => {});
    ref.current?.focus();
    const exit = () => { if (!document.fullscreenElement) onClose(); };
    document.addEventListener("fullscreenchange", exit);
    return () => { document.removeEventListener("fullscreenchange", exit); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };
  }, [onClose]);
  const s = slides[i];
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Slide ${i + 1} of ${slides.length}`}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-ink p-6 outline-none"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === " ") setI((n) => Math.min(slides.length - 1, n + 1));
        if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
        if (e.key === "Escape") onClose();
      }}>
      <div className="w-full max-w-[min(100%,calc((100dvh-6rem)*16/9))] overflow-hidden rounded-xl bg-white">
        {s ? <BoardView objects={s.objects} viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`} mediaUrl={mediaUrl} className="block h-auto w-full" title={`Slide ${i + 1}`} /> : null}
      </div>
      <div className="flex items-center gap-3 text-white">
        <Button variant="secondary" size="sm" onClick={() => setI((n) => Math.max(0, n - 1))} aria-label="Previous slide"><ChevronLeft /></Button>
        <span aria-live="polite">{i + 1} / {slides.length}</span>
        <Button variant="secondary" size="sm" onClick={() => setI((n) => Math.min(slides.length - 1, n + 1))} aria-label="Next slide"><ChevronRight /></Button>
        <Button variant="secondary" size="sm" onClick={onClose}><X />Exit</Button>
      </div>
    </div>
  );
}
