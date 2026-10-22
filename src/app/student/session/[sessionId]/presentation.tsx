"use client";

import { useEffect, useState } from "react";
import { Presentation } from "lucide-react";
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
  const iAmPresenter = pres.presenterId === state.me.id;
  const ours = state.group?.id === pres.groupId;
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
      {iAmPresenter ? <p className="mt-2 text-sm font-semibold text-teal">Your teacher gave you control of the slides.</p> : !ours ? <p className="mt-2 text-xs text-ink-muted">You&apos;re viewing a read-only copy.</p> : null}
    </Card>
  );
}
