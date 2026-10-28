"use client";

import { useState } from "react";
import { Eye, Lock } from "lucide-react";
import { api } from "@/lib/realtime/client";
import type { ReflectionSet } from "@/lib/domain/reflection";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Notice, Select } from "@/components/ui/primitives";

type Detail = { name: string; ratings: Record<string, number>; answers: Record<string, string>; submittedAt: string };

/** Deliberate, logged drill-down into one student's reflection (spec §25). */
export function IndividualReflections({ sessionId, respondents, questions }: { sessionId: string; respondents: { id: string; name: string }[]; questions: ReflectionSet }) {
  const [choice, setChoice] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!respondents.length) return null;
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="flex items-center gap-2 font-semibold"><Lock className="size-4 text-purple" aria-hidden="true" />Individual responses</p>
      <p className="mb-3 text-sm text-ink-muted">Open one student&apos;s answers privately. Each view is recorded in the audit log.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label htmlFor="refl-who" className="sr-only">Student</label>
        <Select id="refl-who" className="w-64" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Choose a student…</option>
          {respondents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Button variant="secondary" disabled={!choice} onClick={async () => {
          setError(null);
          try { setDetail(await api<Detail>(`/api/reports/${sessionId}?reflection=${choice}`)); } catch (e) { setError((e as Error).message); }
        }}><Eye />Open privately</Button>
      </div>
      {error ? <Notice tone="coral" className="mt-2">{error}</Notice> : null}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent title={detail ? `${detail.name}'s reflection` : "Reflection"} description="Private — not shown to students or on the display.">
          {detail ? (
            <div className="flex flex-col gap-4 text-sm">
              <dl className="grid gap-2">
                {questions.ratings.map((q) => (
                  <div key={q.key} className="flex justify-between gap-4"><dt className="text-ink-muted">{q.question}</dt><dd className="font-semibold">{detail.ratings[q.key] ? `${detail.ratings[q.key]} / 5` : "—"}</dd></div>
                ))}
              </dl>
              {questions.questions.map((q) => detail.answers[q.key] ? (
                <div key={q.key}><p className="font-semibold">{q.question}</p><p className="mt-0.5 rounded-lg bg-surface-2 px-3 py-2">{detail.answers[q.key]}</p></div>
              ) : null)}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
