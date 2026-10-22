"use client";

import { useState } from "react";
import { Lock, Pencil, Send, Trash2, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Notice, Textarea } from "@/components/ui/primitives";
import { SpeechButton } from "@/components/live/speech-button";
import { useRun } from "@/components/ui/toast";
import { useWorkspace } from "./context";

const STARTERS = ["I noticed that…", "I think … because …", "One word that stood out to me is…", "This reminds me of…"];

/** Individual thinking (spec §14): private until the stage ends. */
export function Brainstorm() {
  const { group, act, openAssistant } = useWorkspace();
  const run = useRun();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mine = group.ideas.mine;
  const min = group.stage?.config.minIdeasPerStudent ?? 1;

  async function save(submit: boolean) {
    if (!text.trim()) return;
    setSaving(true);
    const ok = await run(() => act({ action: "idea_save", id: editing ?? undefined, body: text, submit }), submit ? "Idea added — it stays private until thinking time ends" : "Draft saved");
    if (ok) { setText(""); setEditing(null); }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Notice tone="teal">
        <span className="inline-flex items-start gap-2"><Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Only you can see your ideas right now. They&apos;re shared with your group when thinking time ends. {min > 0 ? `Aim for ${min} idea${min === 1 ? "" : "s"} you could explain — one thoughtful idea is great.` : ""}</span>
      </Notice>

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
        <label htmlFor="idea-text" className="font-semibold">{editing ? "Edit your idea" : "Your idea"}</label>
        <Textarea id="idea-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Write your idea here…" aria-describedby="idea-hint" />
        <div className="flex flex-wrap gap-1.5" id="idea-hint" aria-label="Sentence starters">
          {STARTERS.map((s) => (
            <button key={s} type="button" className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-muted hover:bg-teal-soft hover:text-teal-strong" onClick={() => setText((t) => (t ? `${t} ${s}` : s))}>{s}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <SpeechButton onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
          <Button variant="ghost" size="sm" onClick={() => openAssistant({ action: "express_idea", text })}>Help me say it <span className="sr-only">(private)</span></Button>
          <span className="ml-auto text-xs text-ink-faint">{text.length}/1000</span>
          <Button variant="secondary" size="sm" onClick={() => save(false)} disabled={!text.trim()} pending={saving}><Save />Save draft</Button>
          <Button size="sm" onClick={() => save(true)} disabled={!text.trim()} pending={saving}><Send />Add idea</Button>
        </div>
      </div>

      {mine.length ? (
        <section aria-labelledby="my-ideas">
          <h2 id="my-ideas" className="mb-2 font-semibold">Your ideas</h2>
          <ul className="flex flex-col gap-2">
            {mine.map((i) => (
              <li key={i.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line">{i.body}</p>
                  <div className="mt-1">{i.shared ? <Badge tone="teal">Shared with group</Badge> : i.status === "submitted" ? <Badge tone="mint"><Check aria-hidden="true" />Added — private until thinking time ends</Badge> : <Badge>Draft</Badge>}</div>
                </div>
                {!i.shared ? (
                  <div className="flex">
                    <Button variant="ghost" size="icon" aria-label="Edit idea" onClick={() => { setEditing(i.id); setText(i.body); document.getElementById("idea-text")?.focus(); }}><Pencil /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete idea" onClick={() => run(() => act({ action: "idea_delete", id: i.id }))}><Trash2 /></Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-sm text-ink-muted">Prefer to share out loud? That&apos;s fine — tell your group, then tap “I&apos;m done thinking”.</p>
    </div>
  );
}
