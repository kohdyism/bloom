"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Megaphone, PauseCircle } from "lucide-react";
import type { StudentState } from "@/lib/modules/sessions/state";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { api } from "@/lib/realtime/client";
import { useMediaQuery } from "@/lib/use-media-query";
import { useToast } from "@/components/ui/toast";
import { useA11y } from "@/components/a11y-provider";
import { Buddy } from "@/components/buddy";
import { Avatar } from "@/components/ui/primitives";
import { artifactBus } from "@/components/collab/artifact-bus";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { WorkspaceContext, type Inserter, type StudentAction, type WorkspaceCtx } from "./context";
import { SessionHeader } from "./session-header";
import { NovaCard } from "./nova-card";
import { StagePanel } from "./stage-panel";
import { SidePanel, type PanelTab } from "./side-panel";
import { BottomBar } from "./bottom-bar";
import { AssistantPanel } from "./assistant-panel";
import { Reflection } from "./reflection";
import { PresentationViewer } from "./presentation";
import { Materials } from "./materials";

export function Workspace({ sessionId, initial }: { sessionId: string; initial: StudentState }) {
  const toast = useToast();
  const { prefs } = useA11y();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrefill, setAssistantPrefill] = useState<{ action?: string; text?: string } | undefined>();
  const [assistantTick, setAssistantTick] = useState(0);
  const [panel, setPanel] = useState<PanelTab | null>(null);
  const [inserter, setInserter] = useState<Inserter | null>(null);
  const [editRequest, setEditRequest] = useState<WorkspaceCtx["editRequest"]>(null);
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
      if (prefs.celebrations) toast({ title: g.stageStatus === "complete" ? "Every stage complete — well done, team!" : `Next: ${g.stage?.title}`, tone: "teal" });
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
  const requestEdit = useCallback((id: string, body: string) => setEditRequest((r) => ({ id, body, n: (r?.n ?? 0) + 1 })), []);

  const s = state.session;
  const g = state.group;
  const inLesson = !!g && (s.status === "active" || s.status === "paused");
  const kind = g?.stageStatus === "complete" ? "complete" : g?.stage?.kind;
  // Ideas and chat live in one side panel. Where the ideas or the chat ARE the activity, they aren't offered twice.
  const tabs: PanelTab[] = [...(kind !== "synthesis" && kind !== "voting" ? ["ideas" as const] : []), ...(kind !== "discussion" ? ["chat" as const] : [])];
  const activePanel = panel && tabs.includes(panel) ? panel : null;
  const overlay = !useMediaQuery("(min-width: 1024px)");

  const openChat = useCallback(() => {
    if (kind === "discussion") document.getElementById("chat-input")?.focus();
    else setPanel("chat");
  }, [kind]);
  const openIdeas = useCallback(() => setPanel("ideas"), []);

  const now = useNow();
  const latestAnnouncement = state.announcements[0];
  const recentAnnouncement = latestAnnouncement && now - new Date(latestAnnouncement.createdAt!).getTime() < 10 * 60_000 ? latestAnnouncement : null;

  const ctxValue: WorkspaceCtx | null = g
    ? { sessionId, state, group: g, act, refresh, openAssistant, openChat, openIdeas, inserter, setInserter, editRequest, requestEdit }
    : null;

  let body: React.ReactNode;
  if (s.status === "ended") {
    body = <Centered><Reflection sessionId={sessionId} state={state} /></Centered>;
  } else if (!g) {
    body = <WaitingRoom state={state} />;
  } else if (s.status === "lobby") {
    body = <GroupReveal state={state} />;
  } else {
    const stage = g.stage;
    body = (
      <>
        <div className="flex min-h-0 flex-1 gap-4 p-4">
          <div className="min-w-0 flex-1 overflow-y-auto rounded-[1.75rem]" id="activity">
            <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-4 pb-2">
              {recentAnnouncement ? (
                <div className="flex items-start gap-2 rounded-2xl border-2 border-blue/30 bg-blue-soft px-4 py-3" role="status">
                  <Megaphone className="mt-0.5 size-5 shrink-0 text-blue" aria-hidden="true" />
                  <p><strong>{recentAnnouncement.toGroup ? "Teacher (to your group): " : "Teacher: "}</strong>{recentAnnouncement.body}</p>
                </div>
              ) : null}
              {s.presentation && kind !== "presentation" ? <PresentationViewer compact /> : null}
              {kind !== "complete" && stage ? (
                <>
                  <h1 className="sr-only">{stage.title}</h1>
                  {stage.instructions ? <TaskText text={stage.instructions} simplified={prefs.simplifiedInstructions} /> : null}
                  <NovaCard />
                </>
              ) : null}
              <StagePanel />
            </div>
          </div>
          {activePanel && !overlay ? <SidePanel tab={activePanel} tabs={tabs} onTab={setPanel} onClose={() => setPanel(null)} overlay={false} /> : null}
        </div>
        <BottomBar panel={activePanel} tabs={tabs} onToggle={(t) => setPanel((p) => (p === t ? null : t))} />
        {activePanel && overlay ? <SidePanel tab={activePanel} tabs={tabs} onTab={setPanel} onClose={() => setPanel(null)} overlay /> : null}
      </>
    );
  }

  return (
    <WorkspaceContext.Provider value={ctxValue}>
      <div data-app-shell className="flex min-h-0 flex-1 flex-col">
        <SessionHeader state={state} connection={connection} sessionId={sessionId} act={act} />
        <p className="sr-only" aria-live="polite">{announce}</p>
        {body}
      </div>
      {s.status === "paused" ? <PausedOverlay /> : null}
      {ctxValue && inLesson ? <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} prefill={assistantPrefill} tick={assistantTick} /> : null}
    </WorkspaceContext.Provider>
  );
}

/** The teacher's task for this stage, in big friendly text. */
function TaskText({ text, simplified }: { text: string; simplified: boolean }) {
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  const [all, setAll] = useState(!simplified || sentences.length <= 1);
  return (
    <div className="px-1 pt-1">
      <p className="text-sm font-bold uppercase tracking-wide text-purple">Your task</p>
      <p className="mt-0.5 whitespace-pre-line font-display text-[1.6rem] font-semibold leading-snug">{all ? text : sentences[0]}</p>
      {!all ? <button type="button" className="mt-1 font-semibold text-teal underline-offset-4 hover:underline" onClick={() => setAll(true)}>Show full instructions</button> : null}
    </div>
  );
}

function Centered({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-8", className)}><div className="mx-auto w-full max-w-3xl">{children}</div></div>;
}

function WaitingRoom({ state }: { state: StudentState }) {
  return (
    <Centered>
      <div className="flex flex-col items-center gap-5 rounded-[2rem] border-2 border-white bg-white/85 px-6 py-12 text-center shadow-soft">
        <div className="flex items-end gap-2"><Buddy who="nova" size={120} mood="happy" /><Buddy who="pip" size={96} mood="happy" /></div>
        <h1 className="font-display text-4xl font-bold">You&apos;re in!</h1>
        <p className="max-w-md text-lg text-ink-muted">Waiting for your teacher to set up groups for <strong className="text-ink">{state.session.title}</strong>.</p>
        <p className="rounded-full bg-sun px-4 py-1 font-semibold" aria-live="polite">{state.session.joinedCount} classmate{state.session.joinedCount === 1 ? " has" : "s have"} joined</p>
      </div>
      <LessonGoals state={state} />
    </Centered>
  );
}

function GroupReveal({ state }: { state: StudentState }) {
  const g = state.group!;
  return (
    <Centered>
      <div className="flex flex-col items-center gap-5 rounded-[2rem] border-2 border-white bg-white/85 px-6 py-10 text-center shadow-soft">
        <Buddy who="nova" size={110} mood="celebrate" />
        <h1 className="font-display text-4xl font-bold">You&apos;re in group {g.name}!</h1>
        <ul className="flex flex-wrap justify-center gap-6">
          {g.members.map((m) => (
            <li key={m.id} className="flex flex-col items-center gap-1.5">
              <Avatar name={m.name} color={m.avatarColor} size="lg" className="size-16 text-xl" />
              <span className="font-semibold">{m.id === state.me.id ? "You" : m.name}</span>
            </li>
          ))}
        </ul>
        <p className="text-ink-muted">Your teacher will start the lesson soon.</p>
      </div>
      <LessonGoals state={state} />
    </Centered>
  );
}

function LessonGoals({ state }: { state: StudentState }) {
  if (!state.session.objectives.length && !state.session.materials.length) return null;
  return (
    <div className="mt-4 rounded-[2rem] border-2 border-white bg-white/85 p-6 shadow-soft">
      {state.session.objectives.length ? (
        <>
          <h2 className="font-display text-xl font-bold">Today you&apos;ll…</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-[1.05rem]">{state.session.objectives.map((o) => <li key={o} className="flex gap-2"><span className="mt-2 size-2 shrink-0 rounded-full bg-purple" aria-hidden="true" />{o}</li>)}</ul>
        </>
      ) : null}
      <Materials materials={state.session.materials} className="mt-4" />
    </div>
  );
}

function PausedOverlay() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#efe9ff]/90 p-6 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="paused-title" aria-describedby="paused-desc">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-[2rem] border-2 border-white bg-white px-8 py-10 text-center shadow-lift">
        <PauseCircle className="size-16 text-purple" aria-hidden="true" />
        <h2 id="paused-title" className="font-display text-4xl font-bold">Paused</h2>
        <p id="paused-desc" className="text-lg text-ink-muted">Your teacher has paused the lesson. Look up and listen in. Your work is saved and the timer has stopped.</p>
      </div>
    </div>
  );
}
