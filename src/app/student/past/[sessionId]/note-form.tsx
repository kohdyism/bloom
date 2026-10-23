"use client";

import { useState, useTransition } from "react";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";
import { saveNoteAction } from "./actions";

const PROMPTS = ["What am I proud of?", "What would I do differently next time?", "What did I learn from someone else?"];

/** A private note to self about this lesson. Only the student sees it. */
export function NoteForm({ sessionId, initial }: { sessionId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { await saveNoteAction(sessionId, text); setSaved(true); }); }}>
      <label htmlFor="lookback" className="font-display text-lg font-semibold">Looking back</label>
      <p className="flex items-center gap-1.5 text-sm text-ink-muted"><Lock className="size-3.5" aria-hidden="true" />A note just for you — nobody else sees it.</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ideas to write about">
        {PROMPTS.map((p) => <button key={p} type="button" onClick={() => { setText((t) => (t ? `${t}\n${p} ` : `${p} `)); setSaved(false); }} className="rounded-full bg-surface-2 px-3 py-1 text-sm hover:bg-purple-soft">{p}</button>)}
      </div>
      <Textarea id="lookback" rows={4} maxLength={2000} value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} placeholder="Write anything you want to remember about this lesson…" />
      <div className="flex items-center gap-2">
        <Button type="submit" pending={pending}>Save my note</Button>
        {saved ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-mint" role="status"><Check className="size-4" aria-hidden="true" />Saved</span> : null}
      </div>
    </form>
  );
}
