"use client";

import { useEffect, useState } from "react";
import { Lock, Send, Save, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";
import { SpeechButton } from "@/components/live/speech-button";
import { useRun } from "@/components/ui/toast";
import { useWorkspace } from "./context";

const STARTERS = ["I think … because …", "What if we…", "I noticed that…"];

/** Individual thinking (spec §14): private until the stage ends. Saved ideas live in the idea bank. */
export function Brainstorm() {
  const { group, act, openAssistant, openIdeas, editRequest } = useWorkspace();
  const run = useRun();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
    const count = group.ideas.mine.filter((i) => i.status === "submitted").length;

  // "Edit" in the idea bank loads that idea back into this box.
  useEffect(() => {
    if (!editRequest) return;
    // Mirrors an explicit user request from the idea bank into the editor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditing(editRequest.id);
    setText(editRequest.body);
    document.getElementById("idea-text")?.focus();
  }, [editRequest]);

  async function save(submit: boolean) {
    if (!text.trim()) return;
    setSaving(true);
    const ok = await run(() => act({ action: "idea_save", id: editing ?? undefined, body: text, submit }), submit ? "Idea added — it stays private until thinking time ends" : "Draft saved");
    if (ok) { setText(""); setEditing(null); }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="idea-text" className="font-display text-xl font-bold">{editing ? "Edit your idea" : "Your idea"}</label>
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-semibold text-teal-strong"><Lock className="size-3.5" aria-hidden="true" />Only you can see this</span>
        {group.ideas.mine.length ? (
          <button type="button" onClick={openIdeas} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-sun px-3 py-1 text-sm font-semibold hover:brightness-95" aria-live="polite">
            {count} idea{count === 1 ? "" : "s"} added · See my ideas
          </button>
        ) : null}
        {editing ? <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink" onClick={() => { setEditing(null); setText(""); }}><X className="size-4" aria-hidden="true" />Cancel edit</button> : null}
      </div>
      <Textarea id="idea-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Write your idea here… one thoughtful idea is great." aria-describedby="idea-hint" className="min-h-40 border-2 border-purple/25 bg-white text-[1.1rem] leading-relaxed focus-visible:border-purple" />
      <div className="flex flex-wrap items-center gap-1.5" id="idea-hint" role="group" aria-label="Sentence starters">
        <span className="mr-1 text-sm text-ink-muted">Try starting with:</span>
        {STARTERS.slice(0, 3).map((s) => (
          <button key={s} type="button" className="rounded-full bg-surface-2 px-3 py-1 text-sm text-ink hover:bg-purple-soft" onClick={() => setText((t) => (t ? `${t} ${s}` : s))}>{s}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <SpeechButton onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
        <Button variant="ghost" size="sm" onClick={() => openAssistant({ action: "express_idea", text })}><Sparkles className="text-purple" />Pip, help me say it <span className="sr-only">(private)</span></Button>
        <span className="ml-auto text-xs text-ink-faint">{text.length}/1000</span>
        <Button variant="secondary" size="sm" onClick={() => save(false)} disabled={!text.trim()} pending={saving}><Save />Save draft</Button>
        <Button size="md" onClick={() => save(true)} disabled={!text.trim()} pending={saving} className="bg-purple hover:bg-purple-strong"><Send />Add idea</Button>
      </div>
    </div>
  );
}
