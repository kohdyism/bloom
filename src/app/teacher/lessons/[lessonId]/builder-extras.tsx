"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, FileText, Image as ImageIcon, Link2, PlayCircle, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, CardTitle, Input, Notice } from "@/components/ui/primitives";
import { StageMedia } from "@/components/live/stage-media";
import { classifyUrl, safeHttpUrl, type StageAttachment } from "@/lib/domain/stage-media";
import { DEFAULT_REFLECTION, newQuestionKey, type ReflectionSet } from "@/lib/domain/reflection";
import { uploadStageFileAction } from "../actions";

const newId = () => Math.random().toString(36).slice(2, 10);
const KIND_ICON = { image: ImageIcon, video: PlayCircle, link: Link2, file: FileText } as const;
const KIND_LABEL = { image: "Picture", video: "Video", link: "Link", file: "File" } as const;

/** Pictures, videos, links/simulations and files shown inline with one stage's instructions. */
export function StageMediaEditor({ lessonId, items, onChange }: { lessonId: string; items: StageAttachment[]; onChange: (v: StageAttachment[]) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [preview, setPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const full = items.length >= 8;

  const addUrl = () => {
    const clean = safeHttpUrl(url);
    const kind = classifyUrl(url);
    if (!clean || !kind) { setError("Paste a full web address starting with https://"); return; }
    setError(null);
    onChange([...items, { id: newId(), kind, url: clean, title: "", embed: false }]);
    setUrl("");
  };
  const upload = (file: File) => {
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("title", file.name.replace(/\.[a-z0-9]+$/i, ""));
    startUpload(async () => {
      const res = await uploadStageFileAction(lessonId, form);
      if (res.error || !res.file) { setError(res.error ?? "Upload failed."); return; }
      const isImage = res.file.mime.startsWith("image/");
      onChange([...items, { id: newId(), kind: isImage ? "image" : "file", url: "", fileId: res.file.id, mime: res.file.mime, title: res.file.title, embed: false }]);
    });
  };
  const patch = (i: number, p: Partial<StageAttachment>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => { const next = [...items]; [next[i], next[i + d]] = [next[i + d], next[i]]; onChange(next); };

  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-semibold">Pictures, videos and links in the instructions</legend>
      <p className="text-sm text-ink-muted">Shown to students right under the task. Paste a YouTube or Vimeo link, a picture address, or a web page or simulation (e.g. PhET), or upload a picture or PDF.</p>
      {items.length ? (
        <ul className="flex flex-col gap-2">
          {items.map((a, i) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <li key={a.id} className="flex flex-col gap-2 rounded-lg bg-surface-2 p-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <Badge>{KIND_LABEL[a.kind]}</Badge>
                  <Input aria-label={`Title for ${KIND_LABEL[a.kind].toLowerCase()} ${i + 1}`} className="h-9 flex-1" placeholder={a.kind === "video" ? "e.g. Watch this first" : "Title (optional)"} value={a.title} onChange={(e) => patch(i, { title: e.target.value.slice(0, 160) })} />
                  <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-white disabled:opacity-30" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></button>
                  <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-white disabled:opacity-30" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></button>
                  <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-coral-soft hover:text-coral" aria-label={`Remove ${KIND_LABEL[a.kind].toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="size-4" /></button>
                </div>
                {a.url ? <p className="truncate pl-6 text-xs text-ink-muted">{a.url}</p> : null}
                {a.kind === "link" ? (
                  <label className="flex items-center gap-2 pl-6 text-sm"><input type="checkbox" className="size-4 accent-[var(--teal)]" checked={a.embed} onChange={(e) => patch(i, { embed: e.target.checked })} />Let students open it inside the task (for simulations; some sites don&apos;t allow this)</label>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {!full ? (
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Web address to add" className="h-10 min-w-56 flex-1" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }} />
          <Button type="button" variant="secondary" size="sm" className="h-10" onClick={addUrl} disabled={!url.trim()}><Plus />Add link</Button>
          <input ref={fileRef} type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain" aria-label="Upload a picture or PDF for this stage" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <Button type="button" variant="secondary" size="sm" className="h-10" pending={uploading} onClick={() => fileRef.current?.click()}><Upload />Upload file</Button>
        </div>
      ) : <p className="text-sm text-ink-muted">That&apos;s the most for one stage (8).</p>}
      {error ? <Notice tone="coral" role="alert">{error}</Notice> : null}
      {items.length ? (
        <div>
          <button type="button" className="text-sm font-semibold text-teal" aria-expanded={preview} onClick={() => setPreview((p) => !p)}>{preview ? "Hide preview" : "Preview what students see"}</button>
          {preview ? <StageMedia items={items} className="mt-2" /> : null}
        </div>
      ) : null}
    </fieldset>
  );
}

/** Library labels for a lesson. */
export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().replace(/\s+/g, " ").slice(0, 30);
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase()) && tags.length < 10) onChange([...tags, t]);
    setText("");
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">Tags</legend>
      <p className="text-sm text-ink-muted">Labels to find this lesson in your library, e.g. a topic, unit or year group.</p>
      {tags.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {tags.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded-full bg-teal-soft py-1 pl-3 pr-1.5 text-sm font-medium text-teal-strong">
              {t}<button type="button" className="inline-flex size-5 items-center justify-center rounded-full hover:bg-white" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}><X className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      ) : null}
      {tags.length < 10 ? (
        <div className="flex gap-2">
          <Input aria-label="New tag" className="h-10" placeholder="e.g. Poetry" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} />
          <Button type="button" variant="secondary" size="sm" className="h-10" disabled={!text.trim()} onClick={add}><Plus />Add tag</Button>
        </div>
      ) : null}
    </fieldset>
  );
}

const SUGGESTED = [
  { kind: "rating" as const, question: "How well did you understand today's topic?", low: "Not well", high: "Very well" },
  { kind: "rating" as const, question: "How confident do you feel about the task content now?", low: "Not confident", high: "Very confident" },
  { kind: "text" as const, question: "What is one thing you learned today?" },
];

/** The questions students answer after the lesson: the standard set, or the teacher's own. */
export function ReflectionEditor({ value, onChange }: { value: ReflectionSet | null; onChange: (v: ReflectionSet | null) => void }) {
  const set = value ?? DEFAULT_REFLECTION;
  const custom = value !== null;
  const keys = [...set.ratings.map((r) => r.key), ...set.questions.map((q) => q.key)];
  const edit = (fn: (s: ReflectionSet) => ReflectionSet) => onChange(fn(structuredClone(set)));
  const addRating = (question = "", low = "Not at all", high = "Very much") => edit((s) => ({ ...s, ratings: [...s.ratings, { key: newQuestionKey(keys), question, low, high, optional: false }] }));
  const addText = (question = "") => edit((s) => ({ ...s, questions: [...s.questions, { key: newQuestionKey(keys), question }] }));
  const empty = set.ratings.some((r) => !r.question.trim()) || set.questions.some((q) => !q.question.trim());

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>Reflection questions</CardTitle>
          <p className="text-sm text-ink-muted">Each student answers these privately when the lesson ends. Only you see their answers. Ask about the group work, the task content (e.g. “How well did you understand the poem?”), or both.</p>
        </div>
        {custom ? <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}><RotateCcw />Use the standard questions</Button> : <Badge tone="teal">Standard questions</Badge>}
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">1–5 scales</h3>
          <ul className="flex flex-col gap-2">
            {set.ratings.map((r, i) => (
              <li key={r.key} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                <div className="flex gap-2">
                  <Input aria-label={`Scale question ${i + 1}`} value={r.question} placeholder="Question" onChange={(e) => edit((s) => { s.ratings[i].question = e.target.value.slice(0, 200); return s; })} />
                  <button type="button" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-coral-soft hover:text-coral" aria-label={`Remove scale question ${i + 1}`} onClick={() => edit((s) => { s.ratings.splice(i, 1); return s; })}><Trash2 className="size-4" /></button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                  <Input aria-label={`Label for 1 on question ${i + 1}`} value={r.low} placeholder="1 means…" onChange={(e) => edit((s) => { s.ratings[i].low = e.target.value.slice(0, 40); return s; })} />
                  <Input aria-label={`Label for 5 on question ${i + 1}`} value={r.high} placeholder="5 means…" onChange={(e) => edit((s) => { s.ratings[i].high = e.target.value.slice(0, 40); return s; })} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--teal)]" checked={r.optional} onChange={(e) => edit((s) => { s.ratings[i].optional = e.target.checked; return s; })} />Optional</label>
                </div>
              </li>
            ))}
          </ul>
          {set.ratings.length < 10 ? <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => addRating()}><Plus />Add a scale question</Button> : null}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Written answers <span className="font-normal text-ink-muted">(always optional for students)</span></h3>
          <ul className="flex flex-col gap-2">
            {set.questions.map((q, i) => (
              <li key={q.key} className="flex gap-2">
                <Input aria-label={`Written question ${i + 1}`} value={q.question} placeholder="Question" onChange={(e) => edit((s) => { s.questions[i].question = e.target.value.slice(0, 200); return s; })} />
                <button type="button" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-coral-soft hover:text-coral" aria-label={`Remove written question ${i + 1}`} onClick={() => edit((s) => { s.questions.splice(i, 1); return s; })}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          {set.questions.length < 6 ? <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => addText()}><Plus />Add a written question</Button> : null}
        </section>
        <section className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
          <h3 className="text-sm font-semibold">Quick add: questions about the task content</h3>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.filter((x) => !set.ratings.some((r) => r.question === x.question) && !set.questions.some((q) => q.question === x.question)).map((x) => (
              <Button key={x.question} type="button" size="sm" variant="secondary" onClick={() => (x.kind === "rating" ? addRating(x.question, x.low, x.high) : addText(x.question))}><Plus />{x.question}</Button>
            ))}
          </div>
        </section>
        {empty ? <Notice tone="amber">Some questions are empty. Fill them in or remove them before you save.</Notice> : null}
        {custom && !set.ratings.length && !set.questions.length ? <Notice tone="amber">With no questions, students will get the standard set.</Notice> : null}
      </CardBody>
    </Card>
  );
}
