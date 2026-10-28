"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowDown, ArrowUp, Copy, Trash2, Plus, Save, Rocket, Sparkles, Check, FileText, Bookmark, Paperclip, Monitor, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, CardTitle, Field, Input, Label, Notice, Select, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogClose, DialogContent, DialogTrigger, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlay";
import { StageIcon } from "@/components/stage-icon";
import {
  COMPLETION_RULES, DEFAULT_ROLES, STAGE_META, contributionKindFor, defaultMinContribution, type LessonDraft, type Stage, type RoleDef,
} from "@/lib/domain/lesson";
import { STAGE_PRESETS, stageFromPreset } from "@/lib/domain/stage-presets";
import { cn, minutesLabel } from "@/lib/utils";
import {
  addMaterialAction, approveDraftAction, deleteLessonAction, duplicateLessonAction, removeMaterialAction, saveLessonAction, type MaterialState,
} from "../actions";
import { launchSessionAction } from "@/app/teacher/sessions/actions";
import { ReflectionEditor, StageMediaEditor, TagEditor } from "./builder-extras";

type Props = {
  lessonId: string;
  initialDraft: LessonDraft;
  initialClassId: string | null;
  classes: { id: string; name: string }[];
  materials: { id: string; kind: string; title: string; body: string; hasFile: boolean }[];
  isTemplate: boolean;
  source: string;
  needsApproval: boolean;
  generatedOrigin?: "ai" | "ai_simulated" | "offline_helper";
  generatedNote?: string;
};

const COMPLETION_LABELS: Record<(typeof COMPLETION_RULES)[number], string> = {
  all_ready: "Everyone confirms they're ready",
  majority_ready: "Most of the group confirms",
  on_requirements: "Requirements met, then the group confirms",
  teacher_only: "Teacher moves the group on",
};

const ORIGIN_LABEL = { ai: "live AI", ai_simulated: "simulated AI (no API key configured)", offline_helper: "offline helper (the AI service was unavailable)" };

export function LessonBuilder(props: Props) {
  const [draft, setDraft] = useState<LessonDraft>(props.initialDraft);
  const [classId, setClassId] = useState<string | null>(props.initialClassId);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const [saving, startSave] = useTransition();
  const [launching, startLaunch] = useTransition();
  const [approving, startApprove] = useTransition();
  const [launchError, setLaunchError] = useState<string | null>(null);

  const update = (fn: (d: LessonDraft) => LessonDraft) => {
    setDraft((d) => fn(structuredClone(d)));
    setDirty(true);
  };
  const updateStage = (i: number, patch: Partial<Stage>) => update((d) => { d.stages[i] = { ...d.stages[i], ...patch }; return d; });
  const updateStageConfig = (i: number, patch: Partial<Stage["config"]>) => update((d) => { d.stages[i].config = { ...d.stages[i].config, ...patch }; return d; });

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const totalSeconds = useMemo(() => draft.stages.reduce((a, s) => a + s.durationSeconds, 0), [draft.stages]);
  const stage = draft.stages[selected];
  const warnings = useMemo(() => lessonWarnings(draft), [draft]);

  function save() {
    startSave(async () => {
      const res = await saveLessonAction(props.lessonId, { draft, classId });
      if (res.ok) { setDirty(false); setStatus({ kind: "saved" }); }
      else setStatus({ kind: "error", message: res.error });
    });
  }

  function launch() {
    setLaunchError(null);
    startLaunch(async () => {
      if (dirty) {
        const res = await saveLessonAction(props.lessonId, { draft, classId });
        if (!res.ok) { setLaunchError(res.error ?? "Save failed"); return; }
        setDirty(false);
      }
      const res = await launchSessionAction(props.lessonId);
      if (res?.error) setLaunchError(res.error);
    });
  }

  const canLaunch = !props.needsApproval && !!classId && !props.isTemplate;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-teal">{props.isTemplate ? "Template" : "Lesson builder"}</p>
          <label htmlFor="lesson-title" className="sr-only">Lesson title</label>
          <input
            id="lesson-title"
            value={draft.title}
            onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
            className="w-full rounded-lg bg-transparent font-display text-2xl font-bold sm:text-3xl hover:bg-surface-2/60 focus:bg-surface"
          />
          <p className="mt-1 text-sm text-ink-muted">{draft.stages.length} stages · {minutesLabel(totalSeconds)} total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted" aria-live="polite">
            {saving ? "Saving…" : dirty ? "Unsaved changes" : status.kind === "saved" ? <span className="inline-flex items-center gap-1 text-mint"><Check className="size-4" aria-hidden="true" />Saved</span> : null}
          </span>
          <Button variant="secondary" onClick={save} pending={saving} disabled={!dirty && status.kind !== "error"}><Save />Save</Button>
          <MoreMenu lessonId={props.lessonId} isTemplate={props.isTemplate} />
          {!props.isTemplate ? (
            <Button onClick={launch} pending={launching} disabled={!canLaunch} title={!classId ? "Choose a class first" : props.needsApproval ? "Approve the AI draft first" : undefined}>
              <Rocket />Launch lesson
            </Button>
          ) : null}
        </div>
      </div>

      {status.kind === "error" ? <Notice tone="coral" role="alert">{status.message}</Notice> : null}
      {launchError ? <Notice tone="coral" role="alert">{launchError}</Notice> : null}

      {props.needsApproval ? (
        <Notice tone="amber" title="This lesson was drafted by AI and needs your approval">
          <p>
            {props.generatedOrigin ? <>Generated by {ORIGIN_LABEL[props.generatedOrigin]}. </> : null}
            Review the learning goals, every stage, the timings and instructions. Edit anything that isn&apos;t right, then approve it. It can&apos;t be launched until you do.
          </p>
          {props.generatedNote ? <p className="mt-2 italic">AI note: “{props.generatedNote}”</p> : null}
          <Button className="mt-3" size="sm" pending={approving} onClick={() => startApprove(async () => {
            if (dirty) await saveLessonAction(props.lessonId, { draft, classId }).then(() => setDirty(false));
            await approveDraftAction(props.lessonId);
          })}><Check />I&apos;ve reviewed it — approve</Button>
        </Notice>
      ) : props.source === "ai" ? <Badge tone="purple" className="self-start"><Sparkles aria-hidden="true" />AI-assisted draft, approved by you</Badge> : null}

      {warnings.length ? (
        <Notice tone="blue" title="Things to check">
          <ul className="list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Notice>
      ) : null}

      <Tabs defaultValue="stages">
        <TabsList aria-label="Lesson builder sections">
          <TabsTrigger value="stages">Stages</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="reflection">Reflection</TabsTrigger>
          <TabsTrigger value="materials">Materials ({props.materials.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="stages" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <ol className="flex flex-col gap-2" aria-label="Stages in order">
                {draft.stages.map((s, i) => (
                  <li key={i}>
                    <div className={cn("flex items-center gap-3 rounded-xl border bg-surface p-2.5 pr-1.5", i === selected ? "border-teal ring-2 ring-teal/20" : "border-line")}>
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSelected(i)} aria-current={i === selected ? "step" : undefined}>
                        <StageIcon kind={s.kind} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{i + 1}. {s.title}</span>
                          <span className="block text-xs text-ink-muted">{STAGE_META[s.kind].label} · {minutesLabel(s.durationSeconds)}</span>
                        </span>
                      </button>
                      <div className="flex">
                        <IconBtn label={`Move ${s.title} up`} disabled={i === 0} onClick={() => { update((d) => { [d.stages[i - 1], d.stages[i]] = [d.stages[i], d.stages[i - 1]]; return d; }); setSelected(i - 1); }}><ArrowUp /></IconBtn>
                        <IconBtn label={`Move ${s.title} down`} disabled={i === draft.stages.length - 1} onClick={() => { update((d) => { [d.stages[i + 1], d.stages[i]] = [d.stages[i], d.stages[i + 1]]; return d; }); setSelected(i + 1); }}><ArrowDown /></IconBtn>
                        <IconBtn label={`Duplicate ${s.title}`} onClick={() => { update((d) => { d.stages.splice(i + 1, 0, { ...structuredClone(d.stages[i]), id: undefined }); return d; }); setSelected(i + 1); }}><Copy /></IconBtn>
                        <IconBtn label={`Remove ${s.title}`} disabled={draft.stages.length <= 1} onClick={() => { update((d) => { d.stages.splice(i, 1); return d; }); setSelected(Math.max(0, i - 1)); }}><Trash2 /></IconBtn>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <AddStage onAdd={(st) => { update((d) => { d.stages.splice(selected + 1, 0, st); return d; }); setSelected(selected + 1); }} />
            </div>

            {stage ? (
              <Card>
                <CardHeader className="flex-row items-center gap-3">
                  <StageIcon kind={stage.kind} />
                  <div>
                    <CardTitle>{STAGE_META[stage.kind].label}</CardTitle>
                    <p className="text-sm text-ink-muted">{STAGE_META[stage.kind].blurb}</p>
                  </div>
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                  <Field id="stage-title" label="Stage title"><Input value={stage.title} onChange={(e) => updateStage(selected, { title: e.target.value })} /></Field>
                  <Field id="stage-instructions" label="Instructions for students" hint="Write directly to students. Short numbered steps work well.">
                    <Textarea rows={5} value={stage.instructions} onChange={(e) => updateStage(selected, { instructions: e.target.value })} />
                  </Field>
                  <StageMediaEditor lessonId={props.lessonId} items={stage.config.attachments ?? []} onChange={(v) => updateStageConfig(selected, { attachments: v })} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="stage-minutes" label="Duration (minutes)" hint="Timers warn and can be extended. Work is never removed when time is up.">
                      <Input type="number" min={0} max={120} value={Math.round(stage.durationSeconds / 60)} onChange={(e) => updateStage(selected, { durationSeconds: Math.max(0, Math.min(120, Number(e.target.value) || 0)) * 60 })} />
                    </Field>
                    <Field id="stage-completion" label="How the group moves on">
                      <Select value={stage.config.completion} onChange={(e) => updateStageConfig(selected, { completion: e.target.value as Stage["config"]["completion"] })}>
                        {COMPLETION_RULES.map((r) => <option key={r} value={r}>{COMPLETION_LABELS[r]}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <StageSpecific stage={stage} onChange={(p) => updateStageConfig(selected, p)} />
                  {stage.kind !== "talk" && stage.kind !== "reflection" ? (
                    <Switch id="stage-chat" label="Group chat during this stage" description={stage.kind === "discussion" ? "Turn off if the group should only talk out loud." : "Turn off to keep students focused on the task. Bloom and Pip stay available."}
                      checked={stage.config.groupChat !== false} onCheckedChange={(v) => updateStageConfig(selected, { groupChat: v })} />
                  ) : null}
                  {stage.kind === "talk" || stage.kind === "discussion" ? (
                    <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-muted">Pip, the private assistant, is always hidden in talk and discussion stages so students talk face to face.</p>
                  ) : draft.config.privateAssistant === false ? (
                    <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-muted">Pip is switched off for this whole lesson (Settings).</p>
                  ) : (
                    <Switch id="stage-pip" label="Enable private assistant (Pip) during this stage" description="Turn off and no student can see or open Pip during this stage."
                      checked={stage.config.privateAssistant !== false} onCheckedChange={(v) => updateStageConfig(selected, { privateAssistant: v })} />
                  )}
                </CardBody>
              </Card>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <SettingsPanel draft={draft} update={update} classId={classId} setClassId={(v) => { setClassId(v); setDirty(true); }} classes={props.classes} isTemplate={props.isTemplate} />
        </TabsContent>

        <TabsContent value="reflection" className="mt-4">
          <ReflectionEditor value={draft.config.reflection ?? null} onChange={(v) => update((d) => ({ ...d, config: { ...d.config, reflection: v } }))} />
        </TabsContent>

        <TabsContent value="materials" className="mt-4">
          <MaterialsPanel lessonId={props.lessonId} materials={props.materials} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IconBtn({ label, children, ...rest }: { label: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30 [&_svg]:size-4" {...rest}>
      {children}
    </button>
  );
}

function AddStage({ onAdd }: { onAdd: (s: Stage) => void }) {
  const list = (mode: "online" | "offline") => (
    <ul className="grid gap-2 sm:grid-cols-2">
      {STAGE_PRESETS.filter((p) => p.mode === mode).map((p) => (
        <li key={p.id}>
          <DialogClose asChild>
            <button type="button" onClick={() => onAdd(stageFromPreset(p))} className="flex h-full w-full items-start gap-3 rounded-xl border border-line p-3 text-left hover:border-teal hover:bg-teal-soft/40">
              <StageIcon kind={p.kind} />
              <span><span className="block font-semibold">{p.label}</span><span className="block text-sm text-ink-muted">{p.blurb}</span></span>
            </button>
          </DialogClose>
        </li>
      ))}
    </ul>
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="soft"><Plus />Add stage</Button>
      </DialogTrigger>
      <DialogContent title="Add a stage" description="Stages are optional and can be reordered. You can edit any of them after adding." wide>
        <Tabs defaultValue="online">
          <TabsList aria-label="Kind of task">
            <TabsTrigger value="online"><Monitor className="size-4" aria-hidden="true" />Online tasks</TabsTrigger>
            <TabsTrigger value="offline"><Users className="size-4" aria-hidden="true" />Offline tasks</TabsTrigger>
          </TabsList>
          <TabsContent value="online">
            <p className="mb-3 text-sm text-ink-muted">Students work on the screen: writing ideas, voting, building the group&apos;s work.</p>
            {list("online")}
          </TabsContent>
          <TabsContent value="offline">
            <p className="mb-3 text-sm text-ink-muted">Away from the screen, in the room: talking, moving and making. Canopy shows the task and timer, then steps back.</p>
            {list("offline")}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ListEditor({ id, label, hint, items, onChange, placeholder, max = 8 }: { id: string; label: string; hint?: string; items: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input aria-label={`${label} ${i + 1}`} value={item} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <IconBtn label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 /></IconBtn>
        </div>
      ))}
      {items.length < max ? (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => onChange([...items, ""])} id={id}><Plus />{placeholder}</Button>
      ) : null}
    </fieldset>
  );
}

/**
 * How much each student adds before their "I'm ready" button unlocks. Only
 * for stages where the contribution happens on screen and can be counted.
 */
function MinContribution({ stage, onChange }: { stage: Stage; onChange: (p: Partial<Stage["config"]>) => void }) {
  const kind = contributionKindFor(stage);
  if (stage.kind === "discussion" && !kind) return <p className="text-sm text-ink-muted">Face to face, so there&apos;s nothing to count on screen: students press “I&apos;m ready” when they&apos;re done talking. Turn the group chat on to set a minimum number of messages.</p>;
  if (stage.kind === "physical" && !kind) return <p className="text-sm text-ink-muted">Turn on photo evidence to require each student to upload photos before “I&apos;m ready” unlocks.</p>;
  if (!kind) return null;
  const value = stage.config.minContribution ?? defaultMinContribution(stage.kind);
  if (kind === "work") {
    return <Switch id="stage-min-work" label="Each student must add to the shared work before “I’m ready” unlocks" checked={value > 0} onCheckedChange={(v) => onChange({ minContribution: v ? 1 : 0 })} />;
  }
  const max = kind === "vote" ? stage.config.votesPerStudent : 20;
  const noun = kind === "vote" ? "Votes" : kind === "message" ? "Chat messages" : "Photos";
  return (
    <Field id="stage-min-contribution" label={`${noun} each student must add before “I’m ready” unlocks`} hint={`The button stays locked until a student reaches this. Set 0 to make it optional.${kind === "vote" ? " It can't be more than the votes per student." : ""}`}>
      <Input type="number" min={0} max={max} value={Math.min(value, max)} onChange={(e) => onChange({ minContribution: Math.max(0, Math.min(max, Number(e.target.value) || 0)) })} />
    </Field>
  );
}

function StageSpecific({ stage, onChange }: { stage: Stage; onChange: (p: Partial<Stage["config"]>) => void }) {
  switch (stage.kind) {
    case "brainstorm":
      return (
        <Field id="stage-min-ideas" label="Ideas each student must add before “I’m done thinking” unlocks" hint="The button stays locked until a student has added this many ideas. Set 0 to make ideas optional. You can always move a group on.">
          <Input type="number" min={0} max={10} value={stage.config.minIdeasPerStudent} onChange={(e) => onChange({ minIdeasPerStudent: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })} />
        </Field>
      );
    case "voting":
      return (
        <>
          <Field id="stage-votes" label="Votes per student">
            <Input type="number" min={1} max={10} value={stage.config.votesPerStudent} onChange={(e) => onChange({ votesPerStudent: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} />
          </Field>
          <MinContribution stage={stage} onChange={onChange} />
        </>
      );
    case "creation":
      return (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Shared workspaces</legend>
          <div className="flex flex-wrap gap-2">
            {(["document", "whiteboard", "slides"] as const).map((a) => (
              <label key={a} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm has-[:checked]:border-teal has-[:checked]:bg-teal-soft">
                <input type="checkbox" className="accent-[var(--teal)]" checked={stage.config.artifacts.includes(a)} onChange={(e) => onChange({ artifacts: e.target.checked ? [...stage.config.artifacts, a] : stage.config.artifacts.filter((x) => x !== a) })} />
                {a === "document" ? "Shared document" : a === "whiteboard" ? "Whiteboard" : "Slides"}
              </label>
            ))}
          </div>
          <div className="mt-4"><MinContribution stage={stage} onChange={onChange} /></div>
        </fieldset>
      );
    case "discussion":
      return <MinContribution stage={stage} onChange={onChange} />;
    case "physical":
      return (
        <>
          <ListEditor id="checkins" label="Progress check-ins" hint="The group ticks these off as they go. The AI never listens to the room." items={stage.config.checkins} onChange={(v) => onChange({ checkins: v })} placeholder="Add check-in" max={10} />
          <Switch id="evidence" label="Photo evidence uploads" checked={stage.config.evidenceUpload} onCheckedChange={(v) => onChange({ evidenceUpload: v })} />
          <MinContribution stage={stage} onChange={onChange} />
        </>
      );
    case "submission":
      return <Switch id="evidence-sub" label="Allow photos of physical work" checked={stage.config.evidenceUpload} onCheckedChange={(v) => onChange({ evidenceUpload: v })} />;
    case "reflection":
      return <ListEditor id="prompts" label="Group reflection prompts" items={stage.config.prompts} onChange={(v) => onChange({ prompts: v })} placeholder="Add prompt" max={6} />;
    default:
      return null;
  }
}

function SettingsPanel({ draft, update, classId, setClassId, classes, isTemplate }: {
  draft: LessonDraft; update: (fn: (d: LessonDraft) => LessonDraft) => void; classId: string | null; setClassId: (v: string | null) => void;
  classes: { id: string; name: string }[]; isTemplate: boolean;
}) {
  const c = draft.config;
  const setConfig = (patch: Partial<LessonDraft["config"]>) => update((d) => ({ ...d, config: { ...d.config, ...patch } }));
  const roleOn = (key: string) => c.roles.some((r) => r.key === key);
  const customRoles = c.roles.filter((r) => !DEFAULT_ROLES.some((d) => d.key === r.key));
  const [newRole, setNewRole] = useState<{ name: string; description: string }>({ name: "", description: "" });

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Lesson details</CardTitle></CardHeader>
        <CardBody className="flex flex-col gap-4">
          {!isTemplate ? (
            <Field id="lesson-class" label="Class">
              <Select value={classId ?? ""} onChange={(e) => setClassId(e.target.value || null)}>
                <option value="">Choose a class…</option>
                {classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </Select>
            </Field>
          ) : null}
          <Field id="lesson-desc" label="Description"><Textarea rows={3} value={draft.description} onChange={(e) => update((d) => ({ ...d, description: e.target.value }))} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="lesson-subject" label="Subject"><Input value={draft.subject} onChange={(e) => update((d) => ({ ...d, subject: e.target.value }))} /></Field>
            <Field id="lesson-year" label="Year level"><Input value={draft.yearLevel} onChange={(e) => update((d) => ({ ...d, yearLevel: e.target.value }))} /></Field>
          </div>
          <ListEditor id="objectives" label="Learning objectives" items={draft.objectives} onChange={(v) => update((d) => ({ ...d, objectives: v }))} placeholder="Add objective" />
          <TagEditor tags={c.tags ?? []} onChange={(v) => setConfig({ tags: v })} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Groups and roles</CardTitle></CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="gmin" label="Smallest group"><Input type="number" min={1} max={8} value={c.groupSizeMin} onChange={(e) => setConfig({ groupSizeMin: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} /></Field>
            <Field id="gmax" label="Largest group"><Input type="number" min={1} max={8} value={c.groupSizeMax} onChange={(e) => setConfig({ groupSizeMax: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} /></Field>
          </div>
          <Switch id="roles-optional" label="Roles are optional" description="Students can choose not to take a role." checked={c.rolesOptional} onCheckedChange={(v) => setConfig({ rolesOptional: v })} />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Roles students can choose</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEFAULT_ROLES.map((r) => (
                <label key={r.key} className="flex cursor-pointer items-start gap-2 rounded-xl border border-line px-3 py-2 text-sm has-[:checked]:border-teal has-[:checked]:bg-teal-soft/50">
                  <input type="checkbox" className="mt-0.5 accent-[var(--teal)]" checked={roleOn(r.key)} onChange={(e) => setConfig({ roles: e.target.checked ? [...c.roles, r] : c.roles.filter((x) => x.key !== r.key) })} />
                  <span><span className="font-semibold">{r.name}</span><span className="block text-ink-muted">{r.description}</span></span>
                </label>
              ))}
              {customRoles.map((r) => (
                <div key={r.key} className="flex items-start gap-2 rounded-xl border border-purple/40 bg-purple-soft/50 px-3 py-2 text-sm">
                  <span className="flex-1"><span className="font-semibold">{r.name}</span> <Badge tone="purple">Custom</Badge><span className="block text-ink-muted">{r.description}</span></span>
                  <IconBtn label={`Remove role ${r.name}`} onClick={() => setConfig({ roles: c.roles.filter((x) => x.key !== r.key) })}><Trash2 /></IconBtn>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-2 rounded-xl bg-surface-2 p-3">
            <p className="text-sm font-semibold">Add a custom role</p>
            <Input aria-label="Custom role name" placeholder="e.g. Evidence checker" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} />
            <Input aria-label="Custom role description" placeholder="What does this role do?" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} />
            <Button type="button" variant="secondary" size="sm" className="self-start" disabled={!newRole.name.trim()} onClick={() => {
              const key = `custom_${newRole.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "role"}`;
              const role: RoleDef = { key, name: newRole.name.trim().slice(0, 40), description: newRole.description.trim().slice(0, 240) };
              setConfig({ roles: [...c.roles.filter((r) => r.key !== key), role] });
              setNewRole({ name: "", description: "" });
            }}><Plus />Add role</Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>AI support</CardTitle><p className="text-sm text-ink-muted">You can change these, or pause AI for a group, during the lesson.</p></CardHeader>
        <CardBody className="flex flex-col gap-4">
          <Field id="intensity" label="Group facilitator intensity">
            <Select value={c.facilitationIntensity} onChange={(e) => setConfig({ facilitationIntensity: e.target.value as typeof c.facilitationIntensity })}>
              <option value="low">Low — only when the group asks</option>
              <option value="moderate">Moderate — stage introductions and occasional guidance (recommended)</option>
              <option value="high">High — structured prompts throughout</option>
            </Select>
          </Field>
          <Field id="assist" label="Private learning assistant">
            <Select value={c.assistanceLevel} onChange={(e) => setConfig({ assistanceLevel: Number(e.target.value) })}>
              <option value={1}>Level 1 — Socratic: hints and guiding questions</option>
              <option value={2}>Level 2 — Structured scaffolding (recommended)</option>
              <option value={3}>Level 3 — Detailed support with analogous worked examples</option>
            </Select>
          </Field>
          <Field id="assist-group" label="Group facilitator academic support">
            <Select value={c.facilitatorAssistanceLevel} onChange={(e) => setConfig({ facilitatorAssistanceLevel: Number(e.target.value) })}>
              <option value={1}>Level 1 — Socratic</option>
              <option value={2}>Level 2 — Structured scaffolding</option>
              <option value={3}>Level 3 — Detailed support</option>
            </Select>
          </Field>
          <Notice>At every level, the AI never writes the group&apos;s assessed answer for them.</Notice>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Collaboration</CardTitle></CardHeader>
        <CardBody className="flex flex-col gap-4">
          <Field id="modality" label="Collaboration style">
            <Select value={c.modality} onChange={(e) => setConfig({ modality: e.target.value as typeof c.modality })}>
              <option value="mixed">Mixed — talk in the room and use Canopy</option>
              <option value="mostly_in_person">Mostly in person — Canopy for structure and recording</option>
              <option value="mostly_digital">Mostly digital — discussion happens in Canopy</option>
            </Select>
          </Field>
          <Field id="anon" label="When ideas are shared with the group">
            <Select value={c.ideaAnonymity} onChange={(e) => setConfig({ ideaAnonymity: e.target.value as typeof c.ideaAnonymity })}>
              <option value="named">Show who wrote each idea</option>
              <option value="anonymous">Keep ideas anonymous to classmates</option>
            </Select>
          </Field>
          <Field id="output" label="Final output">
            <Select value={c.outputType} onChange={(e) => setConfig({ outputType: e.target.value as typeof c.outputType })}>
              <option value="document">Written document</option>
              <option value="whiteboard">Whiteboard</option>
              <option value="slides">Slides</option>
              <option value="photo">Photo of physical work</option>
              <option value="mixed">A mix</option>
            </Select>
          </Field>
          <Field id="chat-supervision" label="Group chat supervision" hint="Supervised: Bloom checks each message before the group sees it. Off-task or unkind messages are held back and the student is told why. Turn the chat on or off for each stage in the stage settings.">
            <Select value={c.chatSupervision ?? "off"} onChange={(e) => setConfig({ chatSupervision: e.target.value as "off" | "ai" })}>
              <option value="off">Open chat</option>
              <option value="ai">Supervised by Bloom (AI)</option>
            </Select>
          </Field>
          <Switch id="lesson-pip" label="Enable private assistant (Pip)" description="Pip gives each student private help with the task. Turn off and no student can see or open Pip in this lesson. You can also turn it off for single stages."
            checked={c.privateAssistant !== false} onCheckedChange={(v) => setConfig({ privateAssistant: v })} />
          <Switch id="pres" label="Groups present their work" checked={c.presentationRequired} onCheckedChange={(v) => setConfig({ presentationRequired: v })} />
          <Switch id="resub" label="Allow resubmission" description="Groups can submit an improved version after submitting." checked={c.allowResubmission} onCheckedChange={(v) => setConfig({ allowResubmission: v })} />
          <Field id="theme" label="Group progress theme" hint="Progress grows with completed stages — never with message counts. Students can minimise it.">
            <Select value={c.gamificationTheme} onChange={(e) => setConfig({ gamificationTheme: e.target.value as typeof c.gamificationTheme })}>
              <option value="garden">Blooming garden</option>
              <option value="constellation">Constellation</option>
              <option value="journey">Adventure journey</option>
              <option value="none">None</option>
            </Select>
          </Field>
          <Field id="warn" label="Timer warning (seconds before the end)">
            <Input type="number" min={0} max={600} value={c.timerWarningSeconds} onChange={(e) => setConfig({ timerWarningSeconds: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })} />
          </Field>
        </CardBody>
      </Card>
    </div>
  );
}

function MaterialsPanel({ lessonId, materials }: { lessonId: string; materials: Props["materials"] }) {
  const [state, action, pending] = useActionState<MaterialState, FormData>(addMaterialAction.bind(null, lessonId), {});
  const [removing, start] = useTransition();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Learning materials</CardTitle><p className="text-sm text-ink-muted">Students in the session can read these. The AI treats them as reference text, never as instructions.</p></CardHeader>
        <CardBody>
          {materials.length === 0 ? <p className="text-sm text-ink-muted">No materials yet.</p> : (
            <ul className="flex flex-col gap-3">
              {materials.map((m) => (
                <li key={m.id} className="flex items-start gap-3 rounded-xl border border-line p-3">
                  {m.hasFile ? <Paperclip className="mt-0.5 size-4 text-ink-muted" aria-hidden="true" /> : <FileText className="mt-0.5 size-4 text-ink-muted" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.title}</p>
                    {m.hasFile ? <a className="text-sm text-teal underline" href={`/api/materials/${m.id}`} target="_blank" rel="noreferrer">Open file</a> : <p className="line-clamp-3 whitespace-pre-line text-sm text-ink-muted">{m.body}</p>}
                  </div>
                  <IconBtn label={`Remove ${m.title}`} disabled={removing} onClick={() => start(() => removeMaterialAction(lessonId, m.id))}><Trash2 /></IconBtn>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><CardTitle>Add material</CardTitle></CardHeader>
        <CardBody>
          <form action={action} className="flex flex-col gap-4">
            <Field id="mat-title" label="Title"><Input name="title" required defaultValue={state.ok ? "" : state.title} key={`t-${state.title ?? ""}`} /></Field>
            <Field id="mat-body" label="Paste text" hint="A poem, extract, problem or brief."><Textarea name="body" rows={6} defaultValue={state.ok ? "" : state.body} key={`b-${(state.body ?? "").length}`} /></Field>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mat-file">…or upload a file</Label>
              <input id="mat-file" name="file" type="file" accept=".pdf,.txt,image/*" className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-soft file:px-3 file:py-2 file:font-semibold file:text-teal-strong" />
              <p className="text-sm text-ink-muted">PDF, image or text, up to 8 MB.</p>
            </div>
            {state.error ? <Notice tone="coral" role="alert">{state.error}</Notice> : null}
            <Button type="submit" pending={pending} className="self-end"><Plus />Add material</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function MoreMenu({ lessonId, isTemplate }: { lessonId: string; isTemplate: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="ghost">More</Button></DialogTrigger>
      <DialogContent title="Lesson options">
        <div className="flex flex-col gap-2">
          <Button variant="secondary" pending={pending} onClick={() => start(() => duplicateLessonAction(lessonId, false))}><Copy />Duplicate lesson</Button>
          {!isTemplate ? <Button variant="secondary" pending={pending} onClick={() => start(() => duplicateLessonAction(lessonId, true))}><Bookmark />Save a copy as a reusable template</Button> : null}
          <Button variant="danger" pending={pending} onClick={() => { if (window.confirm("Delete this lesson? Past session reports are also removed.")) start(() => deleteLessonAction(lessonId)); }}><Trash2 />Delete lesson</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function lessonWarnings(d: LessonDraft): string[] {
  const w: string[] = [];
  const kinds = d.stages.map((s) => s.kind);
  if (d.config.groupSizeMin > d.config.groupSizeMax) w.push("The smallest group size is larger than the largest.");
  const syn = kinds.indexOf("synthesis");
  if (syn >= 0 && !kinds.slice(0, syn).includes("brainstorm")) w.push("Idea synthesis works best after an individual thinking stage.");
  if (d.stages.some((s) => s.kind === "creation" && s.config.artifacts.length === 0)) w.push("A creation stage has no shared workspace selected.");
  if (kinds.includes("presentation") && !kinds.includes("submission")) w.push("Presentations show submitted work, so add a submission stage before presenting.");
  if (d.stages.some((s) => !s.instructions.trim() && s.kind !== "synthesis")) w.push("Some stages have no instructions for students yet.");
  if (d.objectives.length === 0) w.push("Add at least one learning objective.");
  const r = d.config.reflection;
  if (r && (r.ratings.some((x) => !x.question.trim()) || r.questions.some((x) => !x.question.trim()))) w.push("Some reflection questions are empty — fill them in or remove them before saving.");
  return w;
}

