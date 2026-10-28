"use client";

import { useState } from "react";
import { Bot, BotOff, Pause, Play, RotateCcw, SkipForward, StepBack, Sparkles, Send, ArrowRightLeft, FileCheck2, Download } from "lucide-react";
import type { GroupContent, TeacherState } from "@/lib/modules/sessions/state";
import { useLiveState } from "@/lib/realtime/use-live-state";
import { api } from "@/lib/realtime/client";
import { Dialog, DialogContent, SheetContent } from "@/components/ui/overlay";
import { Avatar, Badge, Notice, Select, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/live/countdown";
import { StageIcon } from "@/components/stage-icon";
import { SubmissionView, type SubmissionContent } from "@/components/live/submission-view";
import { AiOriginBadge } from "@/components/live/ai-badge";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { TeacherAction } from "./live-session";

export function GroupDrawer({ sessionId, groupId, onClose, state, act, refreshAll }: {
  sessionId: string; groupId: string | null; onClose: () => void; state: TeacherState; act: (b: TeacherAction) => Promise<void>; refreshAll: () => void;
}) {
  const { data: g, refresh } = useLiveState<GroupContent>({
    url: groupId ? `/api/live/teacher/${sessionId}/groups/${groupId}` : null,
    channels: groupId ? [`group:${groupId}`] : [],
  });
  const run = useRun();
  const [msg, setMsg] = useState("");
  const [moveStudent, setMoveStudent] = useState("");
  const [moveTo, setMoveTo] = useState("");
  const [review, setReview] = useState<string | null>(null);
  // Hide Bloom's and Canopy's messages so the teacher can read only what students wrote.
  const [studentsOnly, setStudentsOnly] = useState(false);
  const shownMessages = (g?.messages ?? []).filter((m) => !studentsOnly || m.kind === "student");
  const doAct = async (b: TeacherAction, ok?: string) => {
    const done = await run(() => act({ ...b, groupId }), ok);
    refresh();
    refreshAll();
    return done;
  };
  const ended = state.session.status === "ended";
  const roleName = (k: string) => state.session.config.roles.find((r) => r.key === k)?.name ?? k;

  return (
    <Dialog open={!!groupId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={g ? `${g.name}` : "Group"} description={g?.stage ? `Stage ${g.stageIndex + 1}: ${g.stage.title}` : undefined} className="max-w-2xl">
        {!g ? <p className="p-5 text-ink-muted">Loading…</p> : (
          <div className="flex flex-col gap-6 p-5">
            {/* Current task */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {g.stage ? <StageIcon kind={g.stage.kind} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{g.stageStatus === "complete" ? "All stages complete" : g.stage?.title}</p>
                  <p className="text-sm text-ink-muted">{g.evaluation?.waitingOn}</p>
                </div>
                {g.stageStatus !== "complete" ? <Countdown timer={g.timer} /> : null}
              </div>
              {g.stage?.instructions ? <p className="whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{g.stage.instructions}</p> : null}
              {!ended ? (
                <div className="flex flex-wrap gap-2">
                  {g.timer.paused && state.session.status !== "paused"
                    ? <Button size="sm" variant="secondary" onClick={() => doAct({ action: "group_pause", paused: false }, "Group resumed")}><Play />Resume group</Button>
                    : <Button size="sm" variant="secondary" onClick={() => doAct({ action: "group_pause", paused: true }, "Group paused")}><Pause />Pause group</Button>}
                  <Button size="sm" variant="secondary" onClick={() => doAct({ action: "group_extend", seconds: 120 }, "+2 minutes")}>+2 min</Button>
                  <Button size="sm" variant="secondary" onClick={() => doAct({ action: "group_extend", seconds: 300 }, "+5 minutes")}>+5 min</Button>
                  <Button size="sm" variant="secondary" disabled={g.stageStatus === "complete"} onClick={() => doAct({ action: "group_advance" }, "Moved to the next stage")}><SkipForward />Next stage</Button>
                  <Button size="sm" variant="ghost" onClick={() => doAct({ action: "group_reset", mode: "restart" }, "Stage restarted")}><RotateCcw />Restart stage</Button>
                  <Button size="sm" variant="ghost" disabled={g.stageIndex === 0 && g.stageStatus !== "complete"} onClick={() => doAct({ action: "group_reset", mode: "back" }, "Moved back a stage")}><StepBack />Back a stage</Button>
                </div>
              ) : null}
            </section>

            {/* What each member has actually written, and the group's shared work */}
            {g.teacherWork ? <WorkByStudent g={g} /> : null}

            {/* Members */}
            <section>
              <h3 className="mb-2 font-semibold">Members</h3>
              <ul className="flex flex-col gap-2">
                {g.members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Avatar name={m.name} color={m.avatarColor} size="sm" />
                    <span className={cn("font-medium", !m.present && "text-ink-muted")}>{m.name}</span>
                    {!m.present ? <Badge>away</Badge> : null}
                    {m.roles.map((r) => <Badge key={r} tone="purple">{roleName(r)}</Badge>)}
                    {g.readyIds.includes(m.id) ? <Badge tone="mint">ready</Badge> : null}
                    {m.handRaised ? <Badge tone="amber">hand raised</Badge> : null}
                  </li>
                ))}
              </ul>
            </section>

            {/* Facilitation controls */}
            {!ended ? (
              <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
                <h3 className="font-semibold">Facilitation</h3>
                <div className="flex flex-wrap gap-2">
                  {g.aiEnabled
                    ? <Button size="sm" variant="secondary" onClick={() => doAct({ action: "group_ai", enabled: false }, "Bloom's group prompts paused")}><BotOff />Take over (pause AI prompts)</Button>
                    : <Button size="sm" variant="secondary" onClick={() => doAct({ action: "group_ai", enabled: true }, "Bloom's group prompts back on")}><Bot />Turn AI prompts back on</Button>}
                  <Button size="sm" variant="ghost" disabled={!g.aiEnabled} onClick={() => doAct({ action: "group_prompt_ai" }, "Asked Bloom for a discussion prompt")}><Sparkles />Ask Bloom to prompt discussion</Button>
                </div>
                <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (msg.trim() && await doAct({ action: "group_message", body: msg })) setMsg(""); }}>
                  <label htmlFor="grp-msg" className="sr-only">Message to the group</label>
                  <Textarea id="grp-msg" rows={1} className="min-h-11" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Post a message to this group…" />
                  <Button type="submit" size="icon" aria-label="Send to group"><Send /></Button>
                </form>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="mv-s" className="text-xs font-semibold">Move a student</label>
                    <Select id="mv-s" className="h-9 w-44" value={moveStudent} onChange={(e) => setMoveStudent(e.target.value)}>
                      <option value="">Student…</option>
                      {state.roster.filter((r) => r.joined).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="mv-g" className="text-xs font-semibold">to</label>
                    <Select id="mv-g" className="h-9 w-36" value={moveTo || groupId || ""} onChange={(e) => setMoveTo(e.target.value)}>
                      {state.groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </Select>
                  </div>
                  <Button size="sm" variant="secondary" disabled={!moveStudent} onClick={async () => { if (await run(() => act({ action: "reassign", studentId: moveStudent, groupId: moveTo || groupId }), "Student moved")) { setMoveStudent(""); refresh(); refreshAll(); } }}><ArrowRightLeft />Move</Button>
                </div>
                <p className="text-xs text-ink-muted">Moved students keep their own ideas in this group; “keep apart” rules are always checked.</p>
              </section>
            ) : null}

            {/* Contributions */}
            <section className="flex flex-col gap-2">
              <h3 className="font-semibold">Shared ideas ({g.ideas.shared.length})</h3>
              {"privateDraftCount" in g.ideas && g.ideas.privateDraftCount ? <p className="text-xs text-ink-muted">{g.ideas.privateDraftCount} idea(s) still private to their authors during thinking time.</p> : null}
              {g.ideas.shared.length ? (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {g.ideas.shared.map((i) => <li key={i.id} className="rounded-lg bg-surface-2 px-3 py-2"><span className="font-semibold">{i.author}:</span> {i.body}</li>)}
                </ul>
              ) : <p className="text-sm text-ink-muted">None yet.</p>}
              {g.synthesis && g.synthesis.clusters.length ? (
                <div className="mt-2 rounded-xl border border-purple/30 bg-purple-soft/40 p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">Themes <AiOriginBadge origin={g.synthesis.origin === "student_edit" ? g.synthesis.aiOrigin : g.synthesis.origin} edited={g.synthesis.origin === "student_edit"} /></p>
                  <ul className="flex flex-col gap-1 text-sm">{g.synthesis.clusters.map((c) => <li key={c.id}><strong>{c.title}</strong> — {c.ideaIds.length} idea{c.ideaIds.length === 1 ? "" : "s"}</li>)}</ul>
                </div>
              ) : null}
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Recent group messages</h3>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input type="checkbox" className="size-4 accent-[var(--teal)]" checked={studentsOnly} onChange={(e) => setStudentsOnly(e.target.checked)} />
                  Show student messages only
                </label>
              </div>
              {shownMessages.length ? (
                <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-xl border border-line p-3 text-sm">
                  {shownMessages.slice(-30).map((m) => (
                    <li key={m.id} className={cn(m.kind === "system" && "text-ink-muted italic")}>
                      <span className="font-semibold">{m.author}</span>{m.kind === "ai" ? <AiOriginBadge origin={m.aiOrigin} className="mx-1" /> : null}: {m.body}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-ink-muted">{studentsOnly && g.messages.length ? "No messages from students yet." : "No written messages — the group may be talking in the room."}</p>}
            </section>

            {/* Submissions */}
            <section className="flex flex-col gap-2">
              <h3 className="font-semibold">Submissions</h3>
              {g.submissions.length ? (
                <ul className="flex flex-col gap-2">
                  {g.submissions.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                      <FileCheck2 className="size-4 text-mint" aria-hidden="true" />
                      <span className="flex-1">Version {x.version} by {x.submittedBy} · {new Date(x.createdAt!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                      <Badge tone={x.status === "reviewed" ? "mint" : x.status === "returned" ? "amber" : "blue"}>{x.status === "submitted" ? "Submitted" : x.status === "reviewed" ? "Reviewed" : "Returned for revision"}</Badge>
                      <Button size="sm" variant="soft" onClick={() => setReview(x.id)}>Review</Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-ink-muted">Nothing submitted yet.</p>}
            </section>
          </div>
        )}
        <SubmissionReview sessionId={sessionId} submissionId={review} onClose={() => setReview(null)} onDone={() => { refresh(); refreshAll(); }} />
      </SheetContent>
    </Dialog>
  );
}

function SubmissionReview({ sessionId, submissionId, onClose, onDone }: { sessionId: string; submissionId: string | null; onClose: () => void; onDone: () => void }) {
  const { data } = useLiveState<{ id: string; version: number; status: string; content: SubmissionContent; feedback: string; note: string }>({
    url: submissionId ? `/api/live/teacher/${sessionId}/submissions/${submissionId}` : null,
    channels: [],
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [view, setView] = useState<string | undefined>();
  const run = useRun();
  const text = feedback ?? data?.feedback ?? "";
  const send = async (status: "reviewed" | "returned") => {
    if (await run(() => api("/api/live/teacher", { method: "POST", json: { action: "review_submission", sessionId, submissionId, status, feedback: text } }), status === "reviewed" ? "Marked as reviewed" : "Returned for revision")) {
      onDone();
      onClose();
      setFeedback(null);
    }
  };
  return (
    <Dialog open={!!submissionId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={data ? `Submission — version ${data.version}` : "Submission"} wide>
        {!data ? <p className="text-ink-muted">Loading…</p> : (
          <div className="flex flex-col gap-4">
            {(data.content.kinds?.length ?? 0) > 1 ? (
              <div className="flex flex-wrap gap-1" role="group" aria-label="Choose view">
                {data.content.kinds!.map((k) => <Button key={k} size="sm" variant={(view ?? data.content.kinds![0]) === k ? "primary" : "secondary"} onClick={() => setView(k)}>{k}</Button>)}
              </div>
            ) : null}
            <SubmissionView content={data.content} view={view} mediaUrl={(id) => `/api/media/${id}`} note={data.note} />
            {data.note ? <Notice title="Group's note">{data.note}</Notice> : null}
            <label htmlFor="fb" className="text-sm font-semibold">Feedback for the group</label>
            <Textarea id="fb" rows={3} value={text} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, and one thing to improve." />
            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild variant="ghost" className="mr-auto"><a href={`/print/${submissionId}`} target="_blank" rel="noreferrer"><Download />Save as PDF</a></Button>
              <Button variant="secondary" onClick={() => send("returned")}>Return for revision</Button>
              <Button onClick={() => send("reviewed")}>Mark reviewed</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WorkByStudent({ g }: { g: GroupContent }) {
  const w = g.teacherWork!;
  const current = w.current as SubmissionContent & { kinds?: string[] };
  const [view, setView] = useState<string | undefined>();
  const kinds = current.kinds ?? [];
  return (
    <section className="flex flex-col gap-3" aria-labelledby="work-title">
      <h3 id="work-title" className="font-semibold">Each student&apos;s work</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {g.members.map((m) => {
          const p = w.perMember.find((x) => x.id === m.id);
          if (!p) return null;
          const nothing = !p.sharedIdeas.length && !p.privateIdeas && !p.messageCount && !p.votes && !p.edits;
          return (
            <li key={m.id} className={cn("flex flex-col gap-2 rounded-xl border p-3 text-sm", nothing ? "border-amber bg-amber-soft/40" : "border-line")}>
              <div className="flex items-center gap-2">
                <Avatar name={m.name} color={m.avatarColor} size="sm" />
                <span className="font-semibold">{m.name}</span>
                {nothing ? <Badge tone="amber">Nothing added yet</Badge> : null}
              </div>
              <p className="text-xs text-ink-muted">
                {p.sharedIdeas.length} idea{p.sharedIdeas.length === 1 ? "" : "s"} shared{p.privateIdeas ? ` · ${p.privateIdeas} still private` : ""} · {p.messageCount} message{p.messageCount === 1 ? "" : "s"} · {p.votes} vote{p.votes === 1 ? "" : "s"} · {p.edits} edit{p.edits === 1 ? "" : "s"} to shared work
              </p>
              {p.sharedIdeas.length ? (
                <ul className="flex flex-col gap-1">{p.sharedIdeas.slice(-4).map((t, i) => <li key={i} className="rounded-lg bg-surface-2 px-2.5 py-1.5">{t}</li>)}</ul>
              ) : null}
              {p.messages.length ? (
                <div>
                  <p className="text-xs font-semibold text-ink-muted">Latest messages</p>
                  <ul className="mt-1 flex flex-col gap-1">{p.messages.map((t, i) => <li key={i} className="rounded-lg border border-line px-2.5 py-1.5 italic">“{t}”</li>)}</ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">Shared work so far</p>
          {kinds.length > 1 ? kinds.map((k) => <Button key={k} size="sm" variant={(view ?? kinds[0]) === k ? "primary" : "secondary"} onClick={() => setView(k)}>{k}</Button>) : null}
        </div>
        {kinds.length ? <SubmissionView content={current} view={view} mediaUrl={(id) => `/api/media/${id}`} /> : <p className="text-sm text-ink-muted">Nothing in the shared document, whiteboard or slides yet.</p>}
      </div>
    </section>
  );
}
