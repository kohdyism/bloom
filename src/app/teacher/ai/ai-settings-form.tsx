"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Save, ShieldCheck, X } from "lucide-react";
import type { AiSettings } from "@/lib/modules/ai-settings";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, Field, Input, Notice, Textarea } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/overlay";
import { saveAiSettingsAction } from "./actions";

const EXAMPLES = [
  "Use UK spelling and simple words.",
  "Never give the answer to a maths question — only hints.",
  "Remind students to use evidence from the text.",
];

export function AiSettingsForm({ initial }: { initial: AiSettings }) {
  const [s, setS] = useState<AiSettings>(initial);
  const [word, setWord] = useState("");
  const [status, setStatus] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [saving, start] = useTransition();
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const addWords = () => {
    const words = word.split(",").map((w) => w.trim().slice(0, 40)).filter(Boolean);
    const next = [...s.bannedWords];
    for (const w of words) if (!next.some((x) => x.toLowerCase() === w.toLowerCase()) && next.length < 100) next.push(w);
    setS({ ...s, bannedWords: next });
    setWord("");
  };
  const save = () => start(async () => setStatus(await saveAiSettingsAction(s)));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Instructions for Bloom and Pip</CardTitle>
          <p className="text-sm text-ink-muted">Bloom (the group helper) and Pip (each student&apos;s private helper) follow these in every lesson, on top of their built-in rules. They can&apos;t switch off the safety rules.</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <Field id="ai-instructions" label="Your instructions" hint={`${s.instructions.length}/2000`}>
            <Textarea rows={7} value={s.instructions} maxLength={2000} placeholder="e.g. Use UK spelling. Ask students to back up ideas with evidence. Never give full answers." onChange={(e) => setS({ ...s, instructions: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.filter((x) => !s.instructions.includes(x)).map((x) => (
              <Button key={x} type="button" size="sm" variant="secondary" onClick={() => setS({ ...s, instructions: (s.instructions.trim() ? `${s.instructions.trim()}\n` : "") + x })}><Plus />{x}</Button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banned words</CardTitle>
          <p className="text-sm text-ink-muted">Messages, ideas and questions to Pip that use these words are held back. The student is told kindly, and you get a flag on the lesson dashboard. Bloom and Pip never use them either.</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {s.bannedWords.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Banned words">
              {s.bannedWords.map((w) => (
                <li key={w} className="inline-flex items-center gap-1 rounded-full bg-coral-soft py-1 pl-3 pr-1.5 text-sm font-medium">
                  {w}<button type="button" className="inline-flex size-5 items-center justify-center rounded-full hover:bg-white" aria-label={`Remove ${w}`} onClick={() => setS({ ...s, bannedWords: s.bannedWords.filter((x) => x !== w) })}><X className="size-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-muted">No banned words yet.</p>}
          <div className="flex gap-2">
            <Input aria-label="Words to ban" className="h-10" placeholder="Type a word, or several separated by commas" value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addWords(); } }} />
            <Button type="button" variant="secondary" size="sm" className="h-10" disabled={!word.trim()} onClick={addWords}><Plus />Add</Button>
          </div>
          <p className="text-xs text-ink-muted">Whole words only, any capitals. Common swear words and unkind words are already caught for you.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Checking students&apos; work</CardTitle></CardHeader>
        <CardBody className="flex flex-col gap-4">
          <Switch id="idea-check" label="Check ideas before the group sees them" description="Nonsense (like “asdfgh”), off-task, unkind or inappropriate ideas are held back with a kind note so the student can try again. Spelling, grammar and length are never judged. When unsure, the idea goes through."
            checked={s.ideaCheck} onCheckedChange={(v) => setS({ ...s, ideaCheck: v })} />
          <p className="text-sm text-ink-muted">Group-chat supervision and Pip are set for each lesson in the lesson builder.</p>
        </CardBody>
      </Card>

      <Card className="border-coral/40">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-coral" aria-hidden="true" />Always on</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm">Safeguarding alerts can&apos;t be switched off. Words that may mean a student is at risk raise a red alert on your dashboard, in the chat, ideas and Pip. Bloom and Pip never write a group&apos;s final work, and never reveal one student&apos;s words to another.</p>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3 xl:col-span-2">
        <Button onClick={save} pending={saving} disabled={!dirty && !status?.error}><Save />Save AI settings</Button>
        {status?.ok && !dirty ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-mint" role="status"><Check className="size-4" aria-hidden="true" />Saved</span> : null}
        {dirty ? <span className="text-sm text-ink-muted">Unsaved changes</span> : null}
        {status?.error ? <Notice tone="coral" role="alert">{status.error}</Notice> : null}
      </div>
    </div>
  );
}
