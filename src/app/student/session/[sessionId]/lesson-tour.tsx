"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Nova, Pip, type MascotMood } from "@/components/mascot";
import { useReducedMotion } from "@/components/a11y-provider";
import { cn } from "@/lib/utils";

export const TOUR_KEY = "bloom.lessonTour.v1";

type Step = { target?: string; title: string; body: string; who?: "nova" | "pip" | "both"; mood?: MascotMood };

const STEPS: Step[] = [
  { who: "both", mood: "happy", title: "Welcome to your lesson!", body: "This is a quick tour of the screen. It takes less than a minute — you can skip it any time." },
  { target: "group-chat", who: "nova", mood: "happy", title: "Group chat with Nova", body: "Talk with your group here. I'm Nova — I help your group discuss. Everyone in your group sees what I say. Press “Ask Nova” when your group is stuck." },
  { target: "pip-chat", who: "pip", mood: "happy", title: "Just me · Pip", body: "I'm Pip, your private helper. Only you see what you ask me. I give hints, not answers." },
  { target: "activity", title: "Your task", body: "What to do right now, and the activity for this stage. It changes as your group moves on." },
  { target: "ideas-tab", title: "Your group's ideas", body: "Ideas from earlier are always here. Copy them, or add them straight into your work." },
  { target: "timer", title: "Time left", body: "How long is left for this stage. Your work saves itself, even when time's up." },
  { target: "my-role", title: "Your role", body: "Your job in the group, if you have one. Tap it to see what it means." },
  { target: "help", title: "Need a hand?", body: "Raise your hand for your group, or ask your teacher privately with “Need help”. Nobody else sees that." },
  { target: "plant", title: "Your group's plant", body: "It grows every time your group finishes a stage together. Tap it to see how it's doing." },
  { target: "ready", title: "I'm ready", body: "When you've done your part, press “I'm ready”. Your group moves on when everyone is ready." },
];

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(name?: string): HTMLElement | null {
  if (!name) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

/**
 * A short spotlight tour of the lesson screen. Steps whose part of the screen
 * isn't showing (e.g. no roles in this lesson, or a phone layout) are skipped.
 * It's a modal dialog: focus moves to it, Escape skips it.
 */
export function LessonTour({ onClose }: { onClose: () => void }) {
  const reduced = useReducedMotion();
  // Only the parts of the screen that are showing right now.
  const [steps] = useState<Step[]>(() => STEPS.filter((s) => !s.target || findTarget(s.target)));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  const measure = useCallback(() => {
    const el = findTarget(step?.target);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    // Re-measure once the browser has finished any scrolling.
    requestAnimationFrame(() => {
      const q = el.getBoundingClientRect();
      setRect({ top: q.top, left: q.left, width: q.width, height: q.height });
    });
  }, [step]);

  // Measuring the highlighted element's position needs the rendered layout.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);
  useEffect(() => { cardRef.current?.focus(); }, [i]);

  const finish = () => {
    try { window.localStorage.setItem(TOUR_KEY, "done"); } catch { /* storage blocked: the tour may show again next time */ }
    onClose();
  };

  // Place the card beside the highlighted area, keeping it on screen.
  const pad = 8;
  const cardW = 340;
  let cardStyle: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = rect.top + rect.height + pad + 16;
    const roomBelow = vh - below > 220;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), vw - cardW - 12);
    if (rect.height > vh * 0.55) {
      // Tall areas (chat, activity): put the card alongside instead.
      const side = rect.left > vw / 2 ? rect.left - cardW - 20 : rect.left + rect.width + 20;
      cardStyle = { left: Math.min(Math.max(12, side), vw - cardW - 12), top: Math.max(12, Math.min(rect.top + 40, vh - 300)) };
    } else {
      cardStyle = roomBelow ? { left, top: below } : { left, top: Math.max(12, rect.top - pad - 16 - 230) };
    }
  }

  const Who = step.who === "pip" ? Pip : Nova;
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" onKeyDown={(e) => { if (e.key === "Escape") finish(); }}>
      {/* Dim everything except the highlighted area (an SVG mask is reliable at any size). */}
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {rect ? <rect x={rect.left - pad} y={rect.top - pad} width={rect.width + pad * 2} height={rect.height + pad * 2} rx="18" fill="black" /> : null}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(29 26 46 / 0.55)" mask="url(#tour-hole)" />
        {rect ? <rect x={rect.left - pad} y={rect.top - pad} width={rect.width + pad * 2} height={rect.height + pad * 2} rx="18" fill="none" stroke="var(--sun)" strokeWidth="4" /> : null}
      </svg>
      <div
        ref={cardRef}
        tabIndex={-1}
        className={cn("absolute flex w-[340px] max-w-[calc(100vw-24px)] flex-col gap-3 rounded-3xl border-2 border-white bg-white p-5 shadow-lift outline-none", !reduced && "animate-pop")}
        style={cardStyle}
      >
        <div className="flex items-start gap-3">
          {step.who === "both" ? (
            <span className="flex shrink-0 items-end"><Nova size={56} mood="happy" /><Pip size={46} mood="happy" /></span>
          ) : step.who ? <Who size={56} mood={step.mood ?? "happy"} /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-purple">Step {i + 1} of {steps.length}</p>
            <h2 id="tour-title" className="font-display text-xl font-bold leading-tight">{step.title}</h2>
          </div>
          <button type="button" onClick={finish} className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-2" aria-label="Skip the tour"><X className="size-5" /></button>
        </div>
        <p id="tour-body" className="text-[1.02rem] leading-snug">{step.body}</p>
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden="true">
            {steps.map((_, n) => <span key={n} className={cn("h-1.5 rounded-full", n === i ? "w-5 bg-purple" : "w-1.5 bg-line-strong")} />)}
          </span>
          <span className="ml-auto flex gap-2">
            {i > 0 ? <button type="button" onClick={() => setI(i - 1)} className="inline-flex h-10 items-center gap-1 rounded-xl px-3 font-semibold text-ink-muted hover:bg-surface-2"><ArrowLeft className="size-4" aria-hidden="true" />Back</button> : <button type="button" onClick={finish} className="inline-flex h-10 items-center rounded-xl px-3 font-semibold text-ink-muted hover:bg-surface-2">Skip tour</button>}
            <button type="button" onClick={() => (last ? finish() : setI(i + 1))} className="inline-flex h-10 items-center gap-1 rounded-xl bg-purple px-4 font-semibold text-white hover:bg-purple-strong">
              {last ? "Let's go!" : <>Next<ArrowRight className="size-4" aria-hidden="true" /></>}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Whether this browser has already seen the tour (false if storage is unavailable). */
export function tourSeen() {
  try { return window.localStorage.getItem(TOUR_KEY) === "done"; } catch { return false; }
}
