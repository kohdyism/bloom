"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Megaphone, MessagesSquare, PauseCircle } from "lucide-react";
import type { StudentState } from "@/lib/modules/sessions/state";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { api } from "@/lib/realtime/client";
import { useMediaQuery } from "@/lib/use-media-query";
import { useToast } from "@/components/ui/toast";
import { useA11y } from "@/components/a11y-provider";
import { SproutBuddy } from "@/components/sprout-buddy";
import { Avatar } from "@/components/ui/primitives";
import { Dialog, SheetContent } from "@/components/ui/overlay";
import { artifactBus } from "@/components/collab/artifact-bus";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { WorkspaceContext, type Inserter, type StudentAction, type WorkspaceCtx } from "./context";
import { SessionHeader } from "./session-header";
import { StageHero } from "./stage-hero";
import { StagePanel } from "./stage-panel";
import { IdeaBank } from "./idea-bank";
import { AssistantPanel } from "./assistant-panel";
import { Chat, ChatDrawer } from "./chat";
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
  const [bankOpen, setBankOpen] = useState(false);
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
  const requestEdit = useCallback((id: string, body: string) => setEditRequest((r) => ({ id, body, n: (r?.n ?? 0) + 1 })), []);

  // Layout: idea bank | activity | chat. Columns appear when there's room;
  // otherwise they open as panels from the right.
  const isXL = useMediaQuery("(min-width: 1280px)");
  const isLG = useMediaQuery("(min-width: 1024px)");
  const s = state.session;
  const g = state.group;
  const inLesson = !!g && (s.status === "active" || s.status === "paused");
  const kind = g?.stageStatus === "complete" ? "complete" : g?.stage?.kind;
  const bankWanted = inLesson && kind !== "synthesis" && kind !== "voting";
  const chatWanted = inLesson && kind !== "discussion";
  const bankColumn = bankWanted && (isXL || (isLG && !chatWanted));
  const chatColumn = chatWanted && isLG;

  const openChat = useCallback(() => {
    if (kind === "discussion" || chatColumn) document.getElementById("chat-input")?.focus();
    else setChatOpen(true);
  }, [kind, chatColumn]);

  const now = useNow();
  const latestAnnouncement = state.announcements[0];
  const recentAnnouncement = latestAnnouncement && now - new Date(latestAnnouncement.createdAt!).getTime() < 10 * 60_000 ? latestAnnouncement : null;

  const ctxValue: WorkspaceCtx | null = g
    ? { sessionId, state, group: g, act, refresh, openAssistant, openChat, inserter, setInserter, editRequest, requestEdit }
    : null;

  let body: React.ReactNode;
  if (s.status === "ended") {
    body = <Centered><Reflection sessionId={sessionId} state={state} /></Centered>;
  } else if (!g) {
    body = <WaitingRoom state={state} />;
  } else if (s.status === "lobby") {
    body = <GroupReveal state={state} />;
  } else {
    const panelButtons = (bankWanted && !bankColumn) || (chatWanted && !chatColumn);
    body = (
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {bankColumn ? <IdeaBank className="w-[18.5rem] shrink-0 2xl:w-[21rem]" /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto rounded-3xl tall:overflow-hidden">
          {recentAnnouncement ? (
            <div className="flex items-start gap-2 rounded-2xl border-2 border-blue/30 bg-blue-soft px-4 py-3" role="status">
              <Megaphone className="mt-0.5 size-5 shrink-0 text-blue" aria-hidden="true" />
              <p><strong>{recentAnnouncement.toGroup ? "Teacher (to your group): " : "Teacher: "}</strong>{recentAnnouncement.body}</p>
            </div>
          ) : null}
          {panelButtons ? (
            <div className="flex flex-wrap gap-2">
              {bankWanted && !bankColumn ? (
                <button type="button" onClick={() => setBankOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-sun px-4 font-semibold text-ink shadow-soft hover:brightness-95">
                  <Lightbulb className="size-5" aria-hidden="true" />Idea bank<span className="rounded-full bg-white/70 px-2 text-sm">{kind === "brainstorm" ? g.ideas.mine.length : g.ideas.shared.length}</span>
                </button>
              ) : null}
              {chatWanted && !chatColumn ? (
                <button type="button" onClick={() => setChatOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-purple px-4 font-semibold text-white shadow-soft hover:bg-purple-strong">
                  <MessagesSquare className="size-5" aria-hidden="true" />Group chat<span className="rounded-full bg-white/25 px-2 text-sm">{g.messages.filter((m) => m.kind !== "system").length}</span>
                </button>
              ) : null}
            </div>
          ) : null}
          {kind !== "complete" ? <StageHero /> : null}
          <div className="flex flex-col gap-3 rounded-3xl tall:min-h-0 tall:flex-1 tall:overflow-y-auto" id="activity">
            {s.presentation && kind !== "presentation" ? <PresentationViewer compact /> : null}
            <StagePanel />
          </div>
        </div>
        {chatColumn ? <Chat title="Group chat" className="w-[20rem] shrink-0 2xl:w-[23rem]" /> : null}
      </div>
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
      {ctxValue ? <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} prefill={assistantPrefill} tick={assistantTick} /> : null}
      {ctxValue && chatWanted && !chatColumn ? <ChatDrawer open={chatOpen} onOpenChange={setChatOpen} /> : null}
      {ctxValue && bankWanted && !bankColumn ? (
        <Dialog open={bankOpen} onOpenChange={setBankOpen}>
          <SheetContent title="Idea bank" description="Your group's ideas — copy them or add them to your work." className="bg-[#fffbea]">
            <IdeaBank className="h-full rounded-none border-0 shadow-none" />
          </SheetContent>
        </Dialog>
      ) : null}
    </WorkspaceContext.Provider>
  );
}

function Centered({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6", className)}><div className="mx-auto w-full max-w-3xl">{children}</div></div>;
}

function WaitingRoom({ state }: { state: StudentState }) {
  return (
    <Centered>
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center gap-6 rounded-[2rem] border-2 border-white bg-white/80 px-6 py-10 shadow-soft sm:px-12">
          <SproutBuddy size={150} mood="happy" />
          <div>
            <h1 className="font-display text-4xl font-bold">You&apos;re in!</h1>
            <p className="mt-2 text-lg text-ink-muted">Waiting for your teacher to set up groups for <strong className="text-ink">{state.session.title}</strong>.</p>
            <p className="mt-3 inline-flex rounded-full bg-sun px-4 py-1 font-semibold" aria-live="polite">{state.session.joinedCount} classmate{state.session.joinedCount === 1 ? " has" : "s have"} joined</p>
          </div>
          <p className="text-sm text-ink-muted">While you wait, tap Sprout to say hi.</p>
        </div>
        <LessonGoals state={state} />
      </div>
    </Centered>
  );
}

function GroupReveal({ state }: { state: StudentState }) {
  const g = state.group!;
  return (
    <Centered>
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex w-full flex-col items-center gap-5 rounded-[2rem] border-2 border-white bg-white/85 px-6 py-8 shadow-soft">
          <SproutBuddy size={130} mood="celebrate" />
          <h1 className="font-display text-4xl font-bold">You&apos;re in group {g.name}!</h1>
          <ul className="flex flex-wrap justify-center gap-5">
            {g.members.map((m) => (
              <li key={m.id} className="flex flex-col items-center gap-1.5">
                <Avatar name={m.name} color={m.avatarColor} size="lg" className="size-16 text-xl" />
                <span className="font-semibold">{m.id === state.me.id ? "You" : m.name}</span>
              </li>
            ))}
          </ul>
          <p className="text-ink-muted">Your teacher will start the lesson soon. Groups can&apos;t begin until then.</p>
        </div>
        <LessonGoals state={state} />
      </div>
    </Centered>
  );
}

function LessonGoals({ state }: { state: StudentState }) {
  if (!state.session.objectives.length && !state.session.materials.length) return null;
  return (
    <div className="w-full rounded-3xl border-2 border-white bg-white/80 p-5 text-left shadow-soft">
      {state.session.objectives.length ? (
        <>
          <h2 className="font-display text-xl font-bold">Today you&apos;ll…</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">{state.session.objectives.map((o, i) => <li key={o} className={cn("rounded-2xl px-3 py-2 font-medium", ["bg-sun-soft", "bg-teal-soft", "bg-purple-soft", "bg-coral-soft"][i % 4])}>{o}</li>)}</ul>
        </>
      ) : null}
      <Materials materials={state.session.materials} className="mt-4" />
    </div>
  );
}

function PausedOverlay() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#efe9ff]/90 p-6 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="paused-title" aria-describedby="paused-desc">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-[2rem] border-2 border-white bg-white/90 px-8 py-10 text-center shadow-lift">
        <PauseCircle className="size-16 text-purple" aria-hidden="true" />
        <h2 id="paused-title" className="font-display text-4xl font-bold">Paused</h2>
        <p id="paused-desc" className="text-lg text-ink-muted">Your teacher has paused the lesson. Look up and listen in. Your work is saved and the timer has stopped.</p>
      </div>
    </div>
  );
}
