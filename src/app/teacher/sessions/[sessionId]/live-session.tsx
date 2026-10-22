"use client";

import { useCallback, useState } from "react";
import type { TeacherState } from "@/lib/modules/sessions/state";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { api } from "@/lib/realtime/client";
import { useToast } from "@/components/ui/toast";
import { useA11y } from "@/components/a11y-provider";
import { Notice } from "@/components/ui/primitives";
import { Lobby } from "./lobby";
import { Dashboard } from "./dashboard";

export type TeacherAction = Record<string, unknown> & { action: string };

/** Soft two-note chime; only when the teacher has sounds turned on. */
function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.45);
    });
  } catch {
    /* audio unavailable */
  }
}

export function LiveSession({ sessionId, initial }: { sessionId: string; initial: TeacherState }) {
  const toast = useToast();
  const { prefs } = useA11y();
  const [focusHelp, setFocusHelp] = useState(0);
  const { data, connection, refresh, error } = useLiveState<TeacherState>({
    url: `/api/live/teacher/${sessionId}/state`,
    channels: [`teacher:${sessionId}`, `session:${sessionId}`],
    initial,
    onEvent: (e) => {
      if (e.event === "help.new") {
        // The reason and message stay in the private panel, not the pop-up.
        const urgent = e.payload.priority === "urgent";
        toast({ title: urgent ? "Urgent: a student needs you" : "New help request", body: urgent ? "A student says something is making them uncomfortable." : "A student has asked for help.", tone: urgent ? "coral" : "amber", action: { label: "View requests", onClick: () => setFocusHelp((n) => n + 1) } });
        if (prefs.sound) chime();
      }
    },
  });

  const act = useCallback(
    async (body: TeacherAction) => {
      await api("/api/live/teacher", { method: "POST", json: { sessionId, ...body } });
      refresh();
    },
    [sessionId, refresh],
  );

  if (!data) return <Notice tone="coral">{error ?? "Couldn't load this lesson."}</Notice>;
  const state = data;

  return state.session.status === "lobby"
    ? <Lobby state={state} act={act} connection={connection} refresh={refresh} />
    : <Dashboard state={state} act={act} connection={connection} refresh={refresh} focusHelp={focusHelp} />;
}
