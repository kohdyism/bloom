"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { DndContext, useDraggable, useDroppable, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Check, ExternalLink, Info, Monitor, Play, Plus, RefreshCw, Shuffle, Sparkles, TriangleAlert, Users } from "lucide-react";
import type { TeacherState } from "@/lib/modules/sessions/state";
import type { ConnectionState } from "@/lib/realtime/client";
import { api } from "@/lib/realtime/client";
import { validateAssignment } from "@/lib/domain/grouping";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, CardBody, CardHeader, CardTitle, Notice } from "@/components/ui/primitives";
import { ConnectionStatus } from "@/components/live/connection-status";
import { Mascot } from "@/components/mascot";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/use-now";
import type { TeacherAction } from "./live-session";
import { EndDialog } from "./dashboard";

type Recommendation = {
  feasible: boolean; groups: string[][]; warnings: { kind: string; message: string }[]; reasons: string[][];
  students: { id: string; name: string; avatarColor: string }[]; basedOn: "joined" | "class"; keepApart: [string, string][]; sizeMin: number; sizeMax: number;
};

export function Lobby({ state, act, connection }: { state: TeacherState; act: (b: TeacherAction) => Promise<void>; connection: ConnectionState; refresh: () => void }) {
  const s = state.session;
  const joined = state.roster.filter((r) => r.joined);
  const notJoined = state.roster.filter((r) => !r.joined);
  const run = useRun();
  const [starting, setStarting] = useState(false);
  const approvedGroups = useMemo(() => state.groups.map((g) => ({ name: g.name, members: g.members })), [state.groups]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal">Lobby · waiting for students</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{s.title}</h1>
          <div className="mt-1 flex items-center gap-3"><ConnectionStatus state={connection} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary"><a href={`/display/${s.displayToken}`} target="_blank" rel="noreferrer"><Monitor />Open classroom display<ExternalLink className="size-3.5" /></a></Button>
          <EndDialog lobby onEnd={() => run(() => act({ action: "end" }), "Lesson ended")} />
          <Button
            size="lg"
            disabled={!s.groupsApproved}
            pending={starting}
            title={!s.groupsApproved ? "Approve groups first" : undefined}
            onClick={async () => { setStarting(true); await run(() => act({ action: "start" })); setStarting(false); }}
          >
            <Play />Start lesson
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <JoinCodeCard code={s.joinCode} expiresAt={s.joinCodeExpiresAt} onRefresh={() => run(() => act({ action: "refresh_code" }), "New code ready")} />
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Users className="size-5 text-teal" aria-hidden="true" />Joined</CardTitle>
              <Badge tone="teal" aria-live="polite">{joined.length} of {state.roster.length}</Badge>
            </CardHeader>
            <CardBody>
              {joined.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm text-ink-muted"><Mascot size={40} mood="thinking" />Waiting for the first student…</div>
              ) : (
                <ul className="flex flex-wrap gap-2" aria-label="Students who have joined">
                  {joined.map((r) => (
                    <li key={r.id} className="animate-pop flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm">
                      <Avatar name={r.name} color={r.avatarColor} size="sm" />{r.name}
                      {r.present ? <span className="size-2 rounded-full bg-mint" title="Connected" aria-label="connected" /> : null}
                    </li>
                  ))}
                </ul>
              )}
              {notJoined.length ? (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-ink-muted">Not joined yet ({notJoined.length})</summary>
                  <p className="mt-2 text-ink-muted">{notJoined.map((r) => r.name).join(", ")}</p>
                </details>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <GroupBuilder sessionId={s.id} roster={state.roster} approved={s.groupsApproved ? approvedGroups : null} act={act} />
      </div>
    </div>
  );
}

function JoinCodeCard({ code, expiresAt, onRefresh }: { code: string; expiresAt: string | null; onRefresh: () => void }) {
  const [svg, setSvg] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/join?code=${code}`;
    QRCode.toString(u, { type: "svg", margin: 1, color: { dark: "#1b2430", light: "#ffffff" } }).then((s) => { setSvg(s); setUrl(u); }).catch(() => setSvg(""));
  }, [code]);
  const now = useNow();
  const expired = expiresAt && now ? new Date(expiresAt).getTime() < now : false;
  return (
    <Card className="overflow-hidden">
      <div className="bg-teal px-5 py-4 text-white">
        <p className="text-sm font-semibold opacity-90">Join code</p>
        <p className="font-display text-5xl font-bold tracking-[0.18em]" data-testid="join-code">{code}</p>
      </div>
      <CardBody className="flex items-center gap-4 pt-4">
        {svg ? <div className="size-28 shrink-0 overflow-hidden rounded-lg border border-line [&_svg]:size-full" role="img" aria-label={`QR code linking to ${url}`} dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="size-28 rounded-lg bg-surface-2" />}
        <div className="text-sm">
          <p className="text-ink-muted">Students sign in with their own account, then enter the code or scan the QR. The code alone doesn&apos;t give access to anything.</p>
          <p className={cn("mt-2 font-semibold", expired ? "text-coral" : "text-ink-muted")}>
            {expired ? "Expired" : `Expires ${expiresAt ? new Date(expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}`}
          </p>
          <Button variant="link" size="sm" onClick={onRefresh}><RefreshCw className="size-3.5" />New code</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function GroupBuilder({ sessionId, roster, approved, act }: {
  sessionId: string; roster: TeacherState["roster"]; approved: { name: string; members: string[] }[] | null; act: (b: TeacherAction) => Promise<void>;
}) {
  const run = useRun();
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [groups, setGroups] = useState<string[][]>(approved?.map((g) => g.members) ?? []);
  const [seed, setSeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const byId = useMemo(() => new Map(roster.map((r) => [r.id, r])), [roster]);
  const names = (id: string) => byId.get(id)?.name ?? "Student";
  const placed = new Set(groups.flat());
  const unassigned = roster.filter((r) => r.joined && !placed.has(r.id));

  async function generate(nextSeed: number) {
    setLoading(true);
    setServerError(null);
    try {
      const r = await api<Recommendation>(`/api/live/teacher/${sessionId}/recommend`, { method: "POST", json: { seed: nextSeed } });
      setRec(r);
      setSeed(nextSeed);
      if (r.feasible) { setGroups(r.groups); setDirty(true); }
    } catch (e) {
      setServerError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const move = (studentId: string, to: number | "new" | "none") => {
    setGroups((prev) => {
      const next = prev.map((g) => g.filter((id) => id !== studentId));
      if (to === "new") next.push([studentId]);
      else if (to !== "none") next[to] = [...(next[to] ?? []), studentId];
      return next.filter((g, i) => g.length > 0 || i < prev.length).filter((g) => g.length > 0);
    });
    setDirty(true);
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const target = String(e.over.id);
    move(String(e.active.id), target === "unassigned" ? "none" : target === "new" ? "new" : Number(target.replace("group-", "")));
  };

  // Reasons describe the engine's arrangement; hide them once the teacher edits.
  const pristine = !!rec && JSON.stringify(rec.groups) === JSON.stringify(groups);
  const keepApart = rec?.keepApart ?? [];
  const check = validateAssignment(groups, keepApart, rec?.sizeMin ?? 1, rec?.sizeMax ?? 8, names);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-purple" aria-hidden="true" />Groups</CardTitle>
          <p className="text-sm text-ink-muted">Canopy suggests groups using size limits, your pairing rules, students&apos; own working preferences and who has worked together recently. You decide.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rec ? <Button variant="secondary" onClick={() => generate(seed + 1)} pending={loading}><Shuffle />Another suggestion</Button> : null}
          <Button variant={rec ? "secondary" : "primary"} onClick={() => generate(seed)} pending={loading && !rec}><Sparkles />{rec || groups.length ? "Re-suggest" : "Suggest groups"}</Button>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {approved && !dirty ? <Notice tone="teal" title="Groups approved">Students can now see their group. You can still change groups and re-approve until you start the lesson.</Notice> : null}
        {serverError ? <Notice tone="coral" role="alert">{serverError}</Notice> : null}
        {rec?.basedOn === "class" ? <Notice tone="blue">No one has joined yet, so this suggestion uses the whole class. Students who don&apos;t join can be removed before approving; late joiners are placed automatically and you can move them.</Notice> : null}
        {rec?.warnings.map((w, i) => (
          <Notice key={i} tone={w.kind === "keep_apart" ? "coral" : "amber"} role={w.kind === "keep_apart" ? "alert" : undefined}>
            <span className="inline-flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{w.message}</span>
          </Notice>
        ))}
        {check.blocking.map((m) => <Notice key={m} tone="coral" role="alert">{m}</Notice>)}
        {check.warnings.map((m) => <Notice key={m} tone="amber">{m}</Notice>)}

        {groups.length === 0 && !rec ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
            <Mascot mood="thinking" size={56} />
            <p className="max-w-md text-sm text-ink-muted">When most students have joined, press <strong>Suggest groups</strong>. You can drag students between groups or use the “Move to” menu on each name.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {groups.map((g, gi) => (
                <GroupColumn key={gi} id={`group-${gi}`} title={approved && !dirty ? approved[gi]?.name ?? `Group ${gi + 1}` : `Group ${gi + 1}`} count={g.length}>
                  {g.map((id) => (
                    <StudentChip key={id} id={id} name={names(id)} color={byId.get(id)?.avatarColor ?? "teal"} joined={!!byId.get(id)?.joined} hasSupports={!!byId.get(id)?.hasSupports}
                      groupCount={groups.length} current={gi} onMove={(to) => move(id, to)} />
                  ))}
                  {pristine && rec?.reasons[gi]?.length ? (
                    <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-xs text-ink-muted">
                      {rec!.reasons[gi].map((r) => <li key={r} className="flex gap-1.5"><Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />{r}</li>)}
                    </ul>
                  ) : null}
                </GroupColumn>
              ))}
              <GroupColumn id="new" title="New group" count={0} muted>
                <p className="text-xs text-ink-muted">Drop a student here to start a new group.</p>
              </GroupColumn>
            </div>
            {unassigned.length ? (
              <GroupColumn id="unassigned" title="Joined but not in a group" count={unassigned.length} muted>
                {unassigned.map((r) => (
                  <StudentChip key={r.id} id={r.id} name={r.name} color={r.avatarColor} joined hasSupports={r.hasSupports} groupCount={groups.length} current={-1} onMove={(to) => move(r.id, to)} />
                ))}
              </GroupColumn>
            ) : null}
          </DndContext>
        )}

        {groups.length ? (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => { setGroups((p) => [...p, []]); }}><Plus />Add empty group</Button>
            <Button
              disabled={check.blocking.length > 0 || groups.every((g) => g.length === 0)}
              pending={saving}
              onClick={async () => {
                setSaving(true);
                const ok = await run(() => act({ action: "approve_groups", groups: groups.filter((g) => g.length) }), "Groups approved — students can see their group");
                if (ok) setDirty(false);
                setSaving(false);
              }}
            >
              <Check />{approved ? "Re-approve groups" : "Approve groups"}
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function GroupColumn({ id, title, count, children, muted }: { id: string; title: string; count: number; children: React.ReactNode; muted?: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={title} className={cn("flex min-h-24 flex-col gap-1.5 rounded-xl border p-3 transition-colors", muted ? "border-dashed border-line-strong bg-surface" : "border-line bg-surface-2", isOver && "border-teal bg-teal-soft/50")}>
      <h3 className="mb-1 flex items-center justify-between text-sm font-semibold">{title}{count ? <span className="text-ink-muted">{count}</span> : null}</h3>
      {children}
    </section>
  );
}

function StudentChip({ id, name, color, joined, hasSupports, groupCount, current, onMove }: {
  id: string; name: string; color: string; joined: boolean; hasSupports: boolean; groupCount: number; current: number; onMove: (to: number | "new" | "none") => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-center gap-2 rounded-lg bg-surface px-2 py-1.5 text-sm shadow-soft", isDragging && "z-10 opacity-80 ring-2 ring-teal")}>
      <button type="button" className="flex min-w-0 flex-1 cursor-grab items-center gap-2 text-left active:cursor-grabbing" {...listeners} {...attributes} aria-label={`Drag ${name}`}>
        <Avatar name={name} color={color} size="sm" />
        <span className="truncate">{name}</span>
        {!joined ? <Badge>not joined</Badge> : null}
        {hasSupports ? <span className="size-1.5 shrink-0 rounded-full bg-purple" title="Has private support settings (only you can see this)" /> : null}
      </button>
      <label className="sr-only" htmlFor={`move-${id}`}>Move {name} to</label>
      <select
        id={`move-${id}`}
        value={current}
        onChange={(e) => onMove(e.target.value === "new" ? "new" : e.target.value === "none" ? "none" : Number(e.target.value))}
        className="h-7 rounded-md border border-line bg-surface px-1 text-xs"
      >
        {current === -1 ? <option value={-1}>Move to…</option> : null}
        {Array.from({ length: groupCount }, (_, i) => <option key={i} value={i}>Group {i + 1}</option>)}
        <option value="new">New group</option>
        <option value="none">Remove</option>
      </select>
    </div>
  );
}
