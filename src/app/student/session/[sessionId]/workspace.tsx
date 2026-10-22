"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Megaphone, PauseCircle } from "lucide-react";
import type { StudentState } from "@/lib/modules/sessions/state";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { api } from "@/lib/realtime/client";
import { useToast } from "@/components/ui/toast";
import { useA11y } from "@/components/a11y-provider";
import { Mascot, MascotSays } from "@/components/mascot";
import { Avatar, Card, Notice } from "@/components/ui/primitives";
import { artifactBus } from "@/components/collab/artifact-bus";
import { useNow } from "@/lib/use-now";
import { WorkspaceContext, type StudentAction } from "./context";
import { TopBar } from "./top-bar";
import { StagePanel } from "./stage-panel";
import { SidePanel } from "./side-panel";
import { AssistantPanel } from "./assistant-panel";
import { ChatDrawer } from "./chat";
import { Reflection } from "./reflection";
import { PresentationViewer } from "./presentation";
import { Materials } from "./materials";

export function Workspace({ sessionId, initial }: { sessionId: string; initial: StudentState }) {
  const toast = useToast();
  const { prefs } = useA11y();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrefill, setAssistantPrefill] = useState<{ action?: string; text?: string } | undefined>();
  const [assistantTick, setAssistantTick] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const me = initial.me.id;
  const [groupId, setGroupId] = useState(initial.group?.id ?? null);

  const channels = useMemo(() => [`session:${sessionId}`, `user:${me}`, ...(groupId ? [`group:${groupId}`] : [])], [sessionId, me, groupId]);
  const { data, connection, refresh } = useLiveState<StudentState>({
    url: `/api/live/student/${sessionId}/state`,
    channels,
    presence: sessionId,
    initial,
    onEvent: (e) => {
      if (e.event === "artifact.update") {
        artifactBus.emit(e.payload as never);
        return true;
      }
      if (e.event === "private_ai.new") setAssistantTick((n) => n + 1);
      if (e.event === "teacher_message.new") toast({ title: "Message from your teacher", body: "Open “Need help” to read it.", tone: "teal" });
      if (e.event === "help.updated") setAssistantTick((n) => n);
    },
  });
  const state = data ?? initial;

  // Follow group changes (e.g. teacher moved this student).
  useEffect(() => {
    const next = state.group?.id ?? null;
    // Switching realtime channels must follow the server's view of membership.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next !== groupId) setGroupId(next);
  }, [state.group?.id, groupId]);

  // After a reconnection, editors re-fetch their full persisted state.
  const prevConn = useRef(connection);
  useEffect(() => {
    if (prevConn.current !== "open" && connection === "open") artifactBus.resync();
    prevConn.current = connection;
  }, [connection]);

  // Gentle stage-change announcement (visual + polite live region; respects celebrations pref).
  const lastStage = useRef(state.group?.stageIndex);
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const g = state.group;
    if (!g) return;
    if (lastStage.current !== undefined && g.stageIndex !== lastStage.current) {
      setAnnounce(g.stageStatus === "complete" ? "Your group finished every stage." : `New stage: ${g.stage?.title}`);
      if (prefs.celebrations) toast({ title: g.stageStatus === "complete" ? "Every stage complete — well done, team!" : `Stage complete! Next: ${g.stage?.title}`, tone: "teal" });
    }
    lastStage.current = g.stageIndex;
  }, [state.group, prefs.celebrations, toast]);

  const act = useCallback(async (b: StudentAction) => {
    const res = await api("/api/live/student", { method: "POST", json: { sessionId, ...b } });
    refresh();
    return res;
  }, [sessionId, refresh]);

  const openAssistant = useCallback((prefill?: { action?: string; text?: string }) => {
    setAssistantPrefill(prefill);
    setAssistantOpen(true);
  }, []);

  const s = state.session;
  const now = useNow();
  const latestAnnouncement = state.announcements[0];
  const recentAnnouncement = latestAnnouncement && now - new Date(latestAnnouncement.createdAt!).getTime() < 10 * 60_000 ? latestAnnouncement : null;

  let body: React.ReactNode;
  if (s.status === "ended") {
    body = <Reflection sessionId={sessionId} state={state} />;
  } else if (!state.group) {
    body = <WaitingRoom state={state} />;
  } else if (s.status === "lobby") {
    body = <GroupReveal state={state} />;
  } else {
    body = (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          {s.presentation ? <PresentationViewer compact /> : null}
          <StagePanel />
        </div>
        <SidePanel />
      </div>
    );
  }

  const ctxValue = state.group
    ? { sessionId, state, group: state.group, act, refresh, openAssistant, openChat: () => setChatOpen(true) }
    : null;

  return (
    <WorkspaceContext.Provider value={ctxValue}>
      <div className="flex min-h-full flex-col">
        <TopBar state={state} connection={connection} sessionId={sessionId} act={act} onAssistant={() => openAssistant()} onChat={() => setChatOpen(true)} assistantTick={assistantTick} />
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
          <p className="sr-only" aria-live="polite">{announce}</p>
          {recentAnnouncement ? (
            <Notice tone="blue" className="mb-4 flex items-start gap-2" role="status">
              <span className="inline-flex items-start gap-2"><Megaphone className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden="true" /><span><strong>{recentAnnouncement.toGroup ? "Teacher (to your group): " : "Teacher: "}</strong>{recentAnnouncement.body}</span></span>
            </Notice>
          ) : null}
          {body}
        </div>
      </div>
      {s.status === "paused" ? <PausedOverlay /> : null}
      {ctxValue ? <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} prefill={assistantPrefill} tick={assistantTick} /> : null}
      {ctxValue ? <ChatDrawer open={chatOpen} onOpenChange={setChatOpen} /> : null}
    </WorkspaceContext.Provider>
  );
}

function WaitingRoom({ state }: { state: StudentState }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-10 text-center">
      <Mascot mood="happy" size={110} />
      <div>
        <h1 className="font-display text-3xl font-bold">You&apos;re in!</h1>
        <p className="mt-2 text-lg text-ink-muted">Waiting for your teacher to set up groups for <strong className="text-ink">{state.session.title}</strong>.</p>
        <p className="mt-1 text-sm text-ink-muted" aria-live="polite">{state.session.joinedCount} classmate{state.session.joinedCount === 1 ? " has" : "s have"} joined</p>
      </div>
      <LessonGoals state={state} />
    </div>
  );
}

function GroupReveal({ state }: { state: StudentState }) {
  const g = state.group!;
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-8 text-center">
      <MascotSays mood="celebrate" size={90}>
        <span className="font-display text-xl font-semibold">You&apos;re in group {g.name}!</span>
      </MascotSays>
      <Card className="w-full p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Your group</h2>
        <ul className="flex flex-wrap justify-center gap-4">
          {g.members.map((m) => (
            <li key={m.id} className="flex flex-col items-center gap-1.5">
              <Avatar name={m.name} color={m.avatarColor} size="lg" />
              <span className="text-sm font-medium">{m.id === state.me.id ? "You" : m.name}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-ink-muted">Your teacher will start the lesson soon. Groups can&apos;t begin until then.</p>
      </Card>
      <LessonGoals state={state} />
    </div>
  );
}

function LessonGoals({ state }: { state: StudentState }) {
  if (!state.session.objectives.length && !state.session.materials.length) return null;
  return (
    <Card className="w-full p-5 text-left">
      {state.session.objectives.length ? (
        <>
          <h2 className="font-display text-lg font-semibold">Today you&apos;ll…</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">{state.session.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
        </>
      ) : null}
      <Materials materials={state.session.materials} className="mt-4" />
    </Card>
  );
}

function PausedOverlay() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-paper/90 p-6 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="paused-title" aria-describedby="paused-desc">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <PauseCircle className="size-14 text-teal" aria-hidden="true" />
        <h2 id="paused-title" className="font-display text-3xl font-bold">Paused</h2>
        <p id="paused-desc" className="text-lg text-ink-muted">Your teacher has paused the lesson. Look up and listen in. Your work is saved and the timer has stopped.</p>
      </div>
    </div>
  );
}
