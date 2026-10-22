"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3, Bot, BotOff, Hand, HandHelping, Megaphone, MessageCircle, Monitor, Pause, Play, Presentation, Send, Square, ExternalLink, Clock3, CircleAlert, Check, Eye, Users,
} from "lucide-react";
import type { TeacherState } from "@/lib/modules/sessions/state";
import type { ConnectionState } from "@/lib/realtime/client";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, CardBody, CardHeader, CardTitle, Notice, Select, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { ConnectionStatus } from "@/components/live/connection-status";
import { Countdown } from "@/components/live/countdown";
import { StageIcon } from "@/components/stage-icon";
import { useRun } from "@/components/ui/toast";
import { helpLabel, ASSIST_LABELS } from "@/lib/domain/help";
import { cn } from "@/lib/utils";
import { VIEW_LABELS } from "@/components/live/submission-view";
import { GroupDrawer } from "./group-drawer";
import type { TeacherAction } from "./live-session";

type Props = { state: TeacherState; act: (b: TeacherAction) => Promise<void>; connection: ConnectionState; refresh: () => void; focusHelp: number };

export function Dashboard({ state, act, connection, refresh, focusHelp }: Props) {
  const s = state.session;
  const run = useRun();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const names = useMemo(() => new Map(state.roster.map((r) => [r.id, r.name])), [state.roster]);
  const groupName = (id: string | null) => state.groups.find((g) => g.id === id)?.name ?? "No group";
  const openHelp = state.help.filter((h) => h.status !== "resolved");

  useEffect(() => {
    if (focusHelp) helpRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusHelp]);

  const present = state.roster.filter((r) => r.present).length;
  const joined = state.roster.filter((r) => r.joined).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header + class controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={s.status === "active" ? "teal" : s.status === "paused" ? "amber" : "neutral"}>{s.status === "active" ? "Live" : s.status === "paused" ? "Paused" : "Ended"}</Badge>
            <ConnectionStatus state={connection} />
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{s.title}</h1>
          <p className="text-sm text-ink-muted"><Users className="mr-1 inline size-4 align-[-3px]" aria-hidden="true" />{present} connected · {joined} joined · {state.roster.length} in class</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost"><a href={`/display/${s.displayToken}`} target="_blank" rel="noreferrer"><Monitor />Display<ExternalLink className="size-3.5" /></a></Button>
          {s.status !== "ended" ? (
            <>
              <AnnounceDialog groups={state.groups.map((g) => ({ id: g.id, name: g.name }))} onSend={(body, groupId) => run(() => act({ action: "announce", body, groupId }), "Announcement sent")} />
              {s.status === "active"
                ? <Button variant="secondary" onClick={() => run(() => act({ action: "pause" }), "Lesson paused for everyone")}><Pause />Pause class</Button>
                : <Button variant="secondary" onClick={() => run(() => act({ action: "resume" }), "Lesson resumed")}><Play />Resume class</Button>}
              <EndDialog onEnd={() => run(() => act({ action: "end" }))} />
            </>
          ) : (
            <Button asChild><Link href={`/teacher/reports/${s.id}`}><BarChart3 />View report</Link></Button>
          )}
        </div>
      </div>

      {s.status === "paused" ? <Notice tone="amber" title="The lesson is paused">Every student sees a calm pause screen. Timers are frozen and all work is saved.</Notice> : null}
      {s.status === "ended" ? (
        <Notice tone="teal" title="Lesson ended">
          Students are being invited to reflect. {state.reflectionsSubmitted} reflection{state.reflectionsSubmitted === 1 ? "" : "s"} received so far.
        </Notice>
      ) : null}

      {/* Help requests — private, never shown to other students */}
      <div ref={helpRef} className="scroll-mt-6">
        <HelpPanel state={state} names={names} groupName={groupName} act={act} />
      </div>

      <PresentationPanel state={state} act={act} names={names} />

      {/* Groups */}
      <section aria-labelledby="groups-heading">
        <h2 id="groups-heading" className="mb-3 font-display text-lg font-semibold">Groups</h2>
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {state.groups.map((g) => {
            const stage = s.stages[g.stageIndex];
            const help = openHelp.filter((h) => h.groupId === g.id).length;
            const needTime = g.evaluation?.needTimeCount ?? 0;
            return (
              <li key={g.id}>
                <Card className={cn("flex h-full flex-col gap-3 p-4", help && "border-amber")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold">{g.name}</h3>
                      <div className="mt-1 flex -space-x-1.5">
                        {g.members.map((id) => {
                          const r = state.roster.find((x) => x.id === id);
                          return <span key={id} className={cn("rounded-full", !r?.present && "opacity-40")}><Avatar name={r?.name ?? "?"} color={r?.avatarColor} size="sm" title={`${r?.name}${r?.present ? "" : " (not connected)"}`} /></span>;
                        })}
                      </div>
                    </div>
                    {g.stageStatus !== "complete" && stage ? <Countdown timer={g.timer} size="sm" /> : <Badge tone="mint">Finished</Badge>}
                  </div>
                  <div className="flex items-center gap-2.5">
                    {stage ? <StageIcon kind={stage.kind} className="size-8" /> : null}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{g.stageStatus === "complete" ? "All stages complete" : `${g.stageIndex + 1}. ${stage?.title}`}</p>
                      <p className="truncate text-xs text-ink-muted">{g.timer.paused ? "Group paused" : g.evaluation?.waitingOn ?? ""}</p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`${g.name} stage progress`} aria-valuemin={0} aria-valuemax={s.stages.length} aria-valuenow={g.stageStatus === "complete" ? s.stages.length : g.stageIndex}>
                    <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${g.progress * 100}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.stageStatus === "ready_check" ? <Badge tone="blue"><Check aria-hidden="true" />Ready check</Badge> : null}
                    {help ? <Badge tone="amber"><HandHelping aria-hidden="true" />{help} help</Badge> : null}
                    {needTime ? <Badge tone="amber"><Clock3 aria-hidden="true" />More time asked</Badge> : null}
                    {g.timer.overdue && g.stageStatus !== "complete" ? <Badge tone="coral"><CircleAlert aria-hidden="true" />Over time</Badge> : null}
                    {g.counts.handsRaised ? <Badge tone="purple"><Hand aria-hidden="true" />{g.counts.handsRaised}</Badge> : null}
                    {!g.aiEnabled ? <Badge><BotOff aria-hidden="true" />AI paused</Badge> : null}
                    {g.submission ? <Badge tone="mint">Submitted v{g.submission.version}{g.submission.status !== "submitted" ? ` · ${g.submission.status}` : ""}</Badge> : null}
                    {g.presentationRequestId ? <Badge tone="coral"><Presentation aria-hidden="true" />Wants to present</Badge> : null}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="soft" onClick={() => setOpenGroup(g.id)}><Eye />Open</Button>
                    {s.status !== "ended" && g.stageStatus !== "complete" ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => run(() => act({ action: "group_extend", groupId: g.id, seconds: 120 }), `${g.name}: +2 minutes`)}>+2 min</Button>
                        <Button size="sm" variant="ghost" onClick={() => run(() => act({ action: "group_advance", groupId: g.id }), `${g.name} moved on`)}>Next stage</Button>
                      </>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <StudentsPanel state={state} act={act} groupName={groupName} />

      <GroupDrawer sessionId={s.id} groupId={openGroup} onClose={() => setOpenGroup(null)} state={state} act={act} refreshAll={refresh} />
    </div>
  );
}

function HelpPanel({ state, names, groupName, act }: { state: TeacherState; names: Map<string, string>; groupName: (id: string | null) => string; act: Props["act"] }) {
  const run = useRun();
  const [showResolved, setShowResolved] = useState(false);
  const visible = state.help.filter((h) => showResolved || h.status !== "resolved");
  const open = state.help.filter((h) => h.status !== "resolved").length;
  return (
    <Card className={open ? "border-amber" : undefined}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><HandHelping className="size-5 text-amber" aria-hidden="true" />Help requests {open ? <Badge tone="amber">{open} open</Badge> : null}</CardTitle>
        <div className="flex items-center gap-3">
          <p className="text-xs text-ink-muted">Private to you — other students never see these.</p>
          {state.help.some((h) => h.status === "resolved") ? <Button size="sm" variant="ghost" onClick={() => setShowResolved((v) => !v)}>{showResolved ? "Hide resolved" : "Show resolved"}</Button> : null}
        </div>
      </CardHeader>
      <CardBody>
        {visible.length === 0 ? <p className="text-sm text-ink-muted">No open requests. Students can ask discreetly at any time.</p> : (
          <ul className="flex flex-col gap-2" aria-live="polite">
            {visible.map((h) => (
              <li key={h.id} className={cn("flex flex-wrap items-start gap-3 rounded-xl border p-3", h.priority === "urgent" && h.status !== "resolved" ? "border-coral bg-coral-soft" : "border-line", h.status === "resolved" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {names.get(h.studentId) ?? "Student"} <span className="font-normal text-ink-muted">· {groupName(h.groupId)} · {new Date(h.createdAt!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  </p>
                  <p className="text-sm">{h.priority === "urgent" ? <strong className="text-coral">Urgent · </strong> : null}{helpLabel(h.reason)}</p>
                  {h.message ? <p className="mt-1 rounded-lg bg-surface px-2.5 py-1.5 text-sm">“{h.message}”</p> : null}
                  <ThreadPreview state={state} studentId={h.studentId} helpId={h.id} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={h.status === "sent" ? "amber" : h.status === "resolved" ? "mint" : "blue"}>{h.status}</Badge>
                  {h.status === "sent" ? <Button size="sm" variant="ghost" onClick={() => run(() => act({ action: "help_status", helpId: h.id, status: "seen" }))}>Mark seen</Button> : null}
                  {h.status !== "resolved" ? (
                    <>
                      <MessageDialog studentName={names.get(h.studentId) ?? "student"} onSend={(body) => run(() => act({ action: "private_message", studentId: h.studentId, body, helpRequestId: h.id }), "Message sent privately")} />
                      <Button size="sm" variant="secondary" onClick={() => run(() => act({ action: "help_status", helpId: h.id, status: "resolved" }))}><Check />Resolve</Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function ThreadPreview({ state, studentId, helpId }: { state: TeacherState; studentId: string; helpId: string }) {
  const msgs = state.threads.filter((t) => t.studentId === studentId && (t.helpRequestId === helpId || t.helpRequestId === null)).slice(-3);
  if (!msgs.length) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1 text-sm">
      {msgs.map((m) => <li key={m.id} className={cn("rounded-lg px-2.5 py-1", m.fromTeacher ? "bg-teal-soft" : "bg-surface-2")}><span className="font-semibold">{m.fromTeacher ? "You" : "Student"}:</span> {m.body}</li>)}
    </ul>
  );
}

function MessageDialog({ studentName, onSend, label = "Reply" }: { studentName: string; onSend: (body: string) => Promise<boolean>; label?: string }) {
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="soft"><MessageCircle />{label}</Button></DialogTrigger>
      <DialogContent title={`Private message to ${studentName}`} description="Only this student will see it.">
        <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); if (!body.trim()) return; setSending(true); if (await onSend(body)) { setBody(""); setOpen(false); } setSending(false); }}>
          <label htmlFor="pm-body" className="sr-only">Message</label>
          <Textarea id="pm-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="e.g. I'm coming over in a minute." autoFocus />
          <Button type="submit" pending={sending} className="self-end"><Send />Send privately</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AnnounceDialog({ groups, onSend }: { groups: { id: string; name: string }[]; onSend: (body: string, groupId: string | null) => Promise<boolean> }) {
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary"><Megaphone />Announce</Button></DialogTrigger>
      <DialogContent title="Send an announcement" description="Class-wide announcements also appear on the classroom display.">
        <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); if (await onSend(body, target || null)) { setBody(""); setOpen(false); } }}>
          <label htmlFor="ann-target" className="text-sm font-semibold">Send to</label>
          <Select id="ann-target" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Whole class</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name} only</option>)}
          </Select>
          <label htmlFor="ann-body" className="text-sm font-semibold">Message</label>
          <Textarea id="ann-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={3} required />
          <Button type="submit" className="self-end"><Megaphone />Send</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EndDialog({ onEnd }: { onEnd: () => Promise<boolean> }) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="danger"><Square />End lesson</Button></DialogTrigger>
      <DialogContent title="End the lesson?" description="All work is saved and becomes read-only. Students will be invited to a short reflection.">
        <div className="flex justify-end gap-2">
          <DialogClose asChild><Button variant="secondary">Keep going</Button></DialogClose>
          <Button variant="danger" pending={pending} onClick={async () => { setPending(true); await onEnd(); setPending(false); }}>End lesson</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PresentationPanel({ state, act, names }: { state: TeacherState; act: Props["act"]; names: Map<string, string> }) {
  const run = useRun();
  const s = state.session;
  const p = s.presentation;
  const ready = state.groups.filter((g) => g.submission);
  const requests = state.groups.filter((g) => g.presentationRequestId);
  const [choice, setChoice] = useState("");
  if (!ready.length && !p) return null;
  const presenting = p ? state.groups.find((g) => g.id === p.groupId) : null;
  return (
    <Card className={p ? "border-coral/50" : undefined}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><Presentation className="size-5 text-coral" aria-hidden="true" />Presentations</CardTitle>
        {p ? <Badge tone="coral">Presenting: {presenting?.name}</Badge> : null}
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {requests.length ? (
          <ul className="flex flex-wrap gap-2">
            {requests.map((g) => (
              <li key={g.id} className="flex items-center gap-2 rounded-xl bg-coral-soft px-3 py-1.5 text-sm">
                <strong>{g.name}</strong> would like to present
                <Button size="sm" onClick={() => run(() => act({ action: "present", groupId: g.id, view: null }))}>Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => run(() => act({ action: "present_decline", requestId: g.presentationRequestId }))}>Not now</Button>
              </li>
            ))}
          </ul>
        ) : null}
        {p ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => run(() => act({ action: "present_update", slide: Math.max(0, p.slide - 1) }))} disabled={p.slide === 0}>Previous</Button>
            <span className="text-sm font-semibold">Slide / page {p.slide + 1}</span>
            <Button size="sm" variant="secondary" onClick={() => run(() => act({ action: "present_update", slide: p.slide + 1 }))}>Next</Button>
            <label htmlFor="pres-view" className="ml-2 text-sm">View</label>
            <Select id="pres-view" className="h-9 w-auto" value={p.view} onChange={(e) => run(() => act({ action: "present_update", view: e.target.value }))}>
              {(["slides", "document", "whiteboard", "media"] as const).map((v) => <option key={v} value={v}>{VIEW_LABELS[v]}</option>)}
            </Select>
            <label htmlFor="pres-who" className="ml-2 text-sm">Slide control</label>
            <Select id="pres-who" className="h-9 w-auto" value={p.presenterId ?? ""} onChange={(e) => run(() => act({ action: "present_update", presenterId: e.target.value || null }))}>
              <option value="">Teacher</option>
              {presenting?.members.map((id) => <option key={id} value={id}>{names.get(id)}</option>)}
            </Select>
            <Button size="sm" variant="danger" className="ml-auto" onClick={() => run(() => act({ action: "present_stop" }), "Back to class overview")}><Square />Stop presenting</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="pres-group" className="text-sm font-semibold">Present a group&apos;s submitted work</label>
              <Select id="pres-group" value={choice} onChange={(e) => setChoice(e.target.value)} className="w-64">
                <option value="">Choose a group…</option>
                {ready.map((g) => <option key={g.id} value={g.id}>{g.name} (v{g.submission!.version})</option>)}
              </Select>
            </div>
            <Button disabled={!choice} onClick={() => run(() => act({ action: "present", groupId: choice, view: null }), "Now presenting on the display and students' devices")}><Presentation />Present</Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function StudentsPanel({ state, act, groupName }: { state: TeacherState; act: Props["act"]; groupName: (id: string | null) => string }) {
  const run = useRun();
  const usage = (id: string) => state.aiUsage.filter((u) => u.studentId === id);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Students</CardTitle>
        <p className="text-sm text-ink-muted">Private assistant use is shown as counts by type only — you can&apos;t read students&apos; private conversations.</p>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="py-2 pr-3 font-semibold">Student</th>
              <th className="py-2 pr-3 font-semibold">Group</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 pr-3 font-semibold">Private assistant</th>
              <th className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {state.roster.map((r) => (
              <tr key={r.id} className="border-b border-line/70 last:border-0">
                <td className="py-2 pr-3"><span className="flex items-center gap-2"><Avatar name={r.name} color={r.avatarColor} size="sm" />{r.name}</span></td>
                <td className="py-2 pr-3">{r.groupId ? groupName(r.groupId) : <span className="text-ink-muted">—</span>}</td>
                <td className="py-2 pr-3">{r.present ? <Badge tone="mint">Connected</Badge> : r.joined ? <Badge>Away</Badge> : <Badge>Not joined</Badge>}</td>
                <td className="py-2 pr-3">
                  {usage(r.id).length ? (
                    <span className="flex flex-wrap gap-1"><Bot className="size-4 text-purple" aria-hidden="true" />{usage(r.id).map((u) => <Badge key={u.action} tone="purple">{ASSIST_LABELS[u.action] ?? u.action} ×{u.count}</Badge>)}</span>
                  ) : <span className="text-ink-muted">—</span>}
                </td>
                <td className="py-2 text-right">
                  {r.joined ? <MessageDialog label="Message" studentName={r.name} onSend={(body) => run(() => act({ action: "private_message", studentId: r.id, body, helpRequestId: null }), "Message sent privately")} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
