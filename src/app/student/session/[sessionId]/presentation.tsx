"use client";

import { useEffect, useState } from "react";
import { Download, Presentation } from "lucide-react";
import { api } from "@/lib/realtime/client";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SubmissionView, type SubmissionContent } from "@/components/live/submission-view";
import { useRun } from "@/components/ui/toast";
import { useWorkspace } from "./context";

type Pres = { groupId: string; groupName: string; members: string[]; view: string; slide: number; presenterId: string | null; content: SubmissionContent; version: number } | null;

/**
 * Presentation viewer on students' own devices (spec §20). Read-only: it
 * shows the submitted snapshot, never the live editable artifact.
 */
export function PresentationViewer({ compact }: { compact?: boolean }) {
  const { state, sessionId, act } = useWorkspace();
  const run = useRun();
  const [pres, setPres] = useState<Pres>(null);
  const [collapsed, setCollapsed] = useState(false);
  const p = state.session.presentation;
  const key = p ? `${p.submissionId}:${p.view}:${p.slide}:${p.presenterId}` : "none";

  useEffect(() => {
    let cancelled = false;
    if (!p) { queueMicrotask(() => setPres(null)); return; }
    api<{ presentation: Pres }>(`/api/live/student/${sessionId}/presentation`).then((r) => { if (!cancelled) setPres(r.presentation); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sessionId]);

  if (!p || !pres) return null;
  const ours = state.group?.id === pres.groupId;
  // The presenting group runs its own slides (unless the teacher picked one person).
  const iAmPresenter = pres.presenterId ? pres.presenterId === state.me.id : ours;
  return (
    <Card className="mb-5 border-coral/50 p-4" aria-labelledby="pres-title">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Presentation className="size-5 text-coral" aria-hidden="true" />
        <h2 id="pres-title" className="font-display text-lg font-semibold">{ours ? "Your group is presenting" : `${pres.groupName} is presenting`}</h2>
        <span className="text-sm text-ink-muted">{pres.members.join(", ")}</span>
        {compact ? <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>{collapsed ? "Show" : "Hide"}</Button> : null}
      </div>
      {!collapsed ? (
        <SubmissionView
          content={pres.content}
          view={pres.view}
          slide={pres.slide}
          onSlide={iAmPresenter ? (n) => void run(() => act({ action: "presenter_slide", slide: n })) : () => {}}
          mediaUrl={(id) => `/api/media/${id}`}
          controls={iAmPresenter}
        />
      ) : null}
      {iAmPresenter ? <p className="mt-2 text-sm font-semibold text-teal">{pres.presenterId ? "Your teacher gave you control of the slides." : "You can move the slides — they change on the big screen too."}</p> : !ours ? <p className="mt-2 text-xs text-ink-muted">You&apos;re viewing a read-only copy.</p> : null}
    </Card>
  );
}

type Own = { id: string; version: number; content: SubmissionContent; note: string } | null;

/**
 * Before (or between) presentations: the group's own submitted work, so
 * they can look at what they made and get ready to talk about it.
 */
export function OwnSubmission() {
  const { group, sessionId } = useWorkspace();
  const latest = group.submissions[0];
  const [own, setOwn] = useState<Own>(null);
  const [view, setView] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    if (!latest) return;
    api<{ submission: Own }>(`/api/live/student/${sessionId}/submission`).then((r) => { if (!cancelled) setOwn(r.submission); }).catch(() => {});
    return () => { cancelled = true; };
  }, [latest?.id, latest, sessionId]);
  if (!latest) return <p className="text-ink-muted">Your group hasn&apos;t submitted anything yet.</p>;
  if (!own) return null;
  const kinds = own.content.kinds ?? [];
  return (
    <Card className="p-4" aria-labelledby="own-sub-title">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="own-sub-title" className="font-display text-lg font-semibold">What your group submitted</h2>
        <span className="text-sm text-ink-muted">Version {own.version}</span>
        <a href={`/print/${own.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-teal hover:underline"><Download className="size-4" aria-hidden="true" />Save as PDF</a>
        {kinds.length > 1 ? (
          <div role="tablist" aria-label="Which part" className="ml-auto flex gap-1 rounded-xl bg-surface-2 p-1">
            {kinds.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={(view ?? kinds[0]) === k} onClick={() => setView(k)} className={(view ?? kinds[0]) === k ? "rounded-lg bg-white px-3 py-1 text-sm font-semibold shadow-soft" : "rounded-lg px-3 py-1 text-sm font-semibold text-ink-muted"}>
                {k === "document" ? "Document" : k === "whiteboard" ? "Whiteboard" : k === "slides" ? "Slides" : k === "media" ? "Photos" : k}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <SubmissionView content={own.content} view={view} mediaUrl={(id) => `/api/media/${id}`} note={own.note} />
    </Card>
  );
}
