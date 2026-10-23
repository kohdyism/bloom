"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { ChevronLeft, ChevronRight, Expand, Megaphone, PauseCircle, Presentation } from "lucide-react";
import type { DisplayState } from "@/lib/modules/sessions/state";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { Mascot } from "@/components/mascot";
import { Countdown } from "@/components/live/countdown";
import { GroupProgress } from "@/components/live/group-progress";
import { StageIcon } from "@/components/stage-icon";
import { SubmissionView, type SubmissionContent } from "@/components/live/submission-view";
import { AVATAR_COLORS, cn } from "@/lib/utils";
import { useNow } from "@/lib/use-now";

/**
 * Public classroom display (spec §3C). Renders only the allow-listed display
 * projection — no accommodations, help requests, private AI, notes or
 * individual reflections can reach this screen.
 */
export function ClassroomDisplay({ token, initial }: { token: string; initial: DisplayState }) {
  const { data } = useLiveState<DisplayState>({ url: `/api/display/${token}`, display: token, initial });
  const d = data ?? initial;
  const now = useNow();
  const mediaUrl = (id: string) => `/api/media/${id}?display=${token}`;

  return (
    <main id="main" className="flex min-h-[calc(100dvh-2rem)] flex-col bg-paper px-8 py-6 text-ink">
      <header className="mb-6 flex items-center gap-4">
        <Mascot size={56} animate={d.status === "lobby"} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-4xl font-bold">{d.title}</h1>
          {d.objectives.length ? <p className="truncate text-xl text-ink-muted">{d.objectives[0]}</p> : null}
        </div>
        {d.joinCode && d.status !== "lobby" ? <p className="text-right text-lg text-ink-muted">Join code <span className="font-display text-3xl font-bold tracking-widest text-ink">{d.joinCode}</span></p> : null}
      </header>

      {d.announcement && now - new Date(d.announcement.createdAt!).getTime() < 15 * 60_000 ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-blue-soft px-6 py-4 text-2xl" role="status">
          <Megaphone className="size-7 shrink-0 text-blue" aria-hidden="true" />{d.announcement.body}
        </div>
      ) : null}

      {d.status === "paused" ? (
        <Centered><PauseCircle className="size-24 text-teal" aria-hidden="true" /><p className="font-display text-6xl font-bold">Paused</p><p className="text-2xl text-ink-muted">Eyes this way, please.</p></Centered>
      ) : d.status === "ended" ? (
        <Centered><Mascot mood="celebrate" size={160} /><p className="font-display text-5xl font-bold">Great work today, everyone!</p><p className="text-2xl text-ink-muted">Please complete the short reflection on your device.</p></Centered>
      ) : d.presentation ? (
        <PresentationView p={d.presentation} mediaUrl={mediaUrl} token={token} />
      ) : d.status === "lobby" ? (
        <Lobby d={d} />
      ) : (
        <Overview d={d} />
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">{children}</div>;
}

function Lobby({ d }: { d: DisplayState }) {
  const [svg, setSvg] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (!d.joinCode) return;
    const url = `${window.location.origin}/join?code=${d.joinCode}`;
    QRCode.toString(url, { type: "svg", margin: 1 }).then((s) => { setSvg(s); setOrigin(window.location.host); }).catch(() => {});
  }, [d.joinCode]);
  return (
    <div className="grid flex-1 items-center gap-10 lg:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-surface p-8 shadow-lift">
        <p className="text-2xl font-semibold text-ink-muted">Sign in to Canopy, then enter</p>
        <p className="font-display text-8xl font-bold tracking-[0.15em] text-teal" data-testid="display-join-code">{d.joinCode}</p>
        {svg ? <div className="size-56 [&_svg]:size-full" role="img" aria-label="QR code to join" dangerouslySetInnerHTML={{ __html: svg }} /> : null}
        <p className="text-lg text-ink-muted">{origin}/join</p>
      </div>
      <div>
        <p className="mb-4 font-display text-3xl font-semibold" aria-live="polite">{d.joined.length} joined</p>
        <ul className="flex flex-wrap gap-3">
          {d.joined.map((j, i) => {
            const c = AVATAR_COLORS[j.avatarColor] ?? AVATAR_COLORS.teal;
            return <li key={i} className="animate-pop rounded-full px-5 py-2.5 text-2xl font-semibold" style={{ background: c.bg, color: c.fg }}>{j.name}</li>;
          })}
        </ul>
        {d.groups.length ? <p className="mt-8 text-2xl text-ink-muted">Groups are ready — check your device to see yours.</p> : <p className="mt-8 text-2xl text-ink-muted">Waiting for everyone to join…</p>}
      </div>
    </div>
  );
}

function Overview({ d }: { d: DisplayState }) {
  return (
    <ul className="grid flex-1 content-start gap-5 md:grid-cols-2 xl:grid-cols-3">
      {d.groups.map((g) => {
        const stage = d.stages[g.stageIndex];
        const done = g.stageStatus === "complete" ? d.stages.length : g.stageIndex;
        return (
          <li key={g.id} className="flex items-center gap-5 rounded-3xl bg-surface p-6 shadow-soft">
            <GroupProgress theme={d.theme === "none" ? "garden" : d.theme} progress={g.progress} stagesDone={done} totalStages={d.stages.length} size={110} label={`${g.name}: ${done} of ${d.stages.length} stages complete`} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-3xl font-bold">{g.name}</p>
              <p className="mt-1 flex items-center gap-2 text-xl text-ink-muted">
                {stage && g.stageStatus !== "complete" ? <><StageIcon kind={stage.kind} className="size-8" />{stage.title}</> : "All stages complete"}
              </p>
              {g.stageStatus !== "complete" ? <Countdown timer={g.timer} size="lg" className="mt-3" /> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PresentationView({ p, mediaUrl, token }: { p: NonNullable<DisplayState["presentation"]>; mediaUrl: (id: string) => string; token: string }) {
  const content = p.content as SubmissionContent;
  const total = p.view === "slides" ? content.slides?.slides.length ?? 0 : 0;
  // Moves show straight away here; the server tells everyone else.
  const [local, setLocal] = useState<{ slide: number; base: number } | null>(null);
  // Once the shared slide changes (our move landed, or a student moved it), it wins.
  if (local && local.base !== p.slide) setLocal(null);
  const slide = local && local.base === p.slide ? local.slide : p.slide;
  const go = useCallback((n: number) => {
    if (!total) return;
    const next = Math.max(0, Math.min(total - 1, n));
    if (next === slide) return;
    setLocal({ slide: next, base: p.slide });
    void fetch(`/api/display/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slide: next }) }).catch(() => setLocal(null));
  }, [total, slide, p.slide, token]);
  useEffect(() => {
    if (!total) return;
    // Arrow keys, space and presentation clickers (which send PageUp/PageDown).
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(slide + 1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(slide - 1); }
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, slide, total]);
  const fullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.().catch(() => {}); };
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <p className="flex min-w-0 flex-1 items-center gap-3 font-display text-3xl font-semibold"><Presentation className="size-8 shrink-0 text-coral" aria-hidden="true" />{p.groupName} presents<span className="truncate text-xl font-normal text-ink-muted">{p.members.join(", ")}</span></p>
        <button type="button" onClick={fullscreen} className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-ink-muted hover:bg-surface-2"><Expand className="size-5" aria-hidden="true" />Full screen</button>
      </div>
      <div className={cn("mx-auto w-full", p.view === "slides" ? "max-w-[min(100%,calc((100dvh-16rem)*16/9))]" : "max-w-6xl")}>
        <SubmissionView content={content} view={p.view} slide={slide} onSlide={go} mediaUrl={mediaUrl} large controls={false} />
      </div>
      {total > 1 ? (
        <div className="mx-auto flex items-center gap-4" role="group" aria-label="Slide controls">
          <button type="button" onClick={() => go(slide - 1)} disabled={slide === 0} aria-label="Previous slide" className="inline-flex size-14 items-center justify-center rounded-2xl bg-surface shadow-soft hover:bg-surface-2 disabled:opacity-40"><ChevronLeft className="size-8" /></button>
          <span className="min-w-28 text-center font-display text-xl font-semibold tabular-nums">{slide + 1} / {total}</span>
          <button type="button" onClick={() => go(slide + 1)} disabled={slide >= total - 1} aria-label="Next slide" className="inline-flex size-14 items-center justify-center rounded-2xl bg-coral text-white shadow-soft hover:brightness-95 disabled:opacity-40"><ChevronRight className="size-8" /></button>
          <span className="text-sm text-ink-muted">or use the arrow keys / a clicker</span>
        </div>
      ) : null}
    </div>
  );
}
