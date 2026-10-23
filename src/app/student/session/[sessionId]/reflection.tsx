"use client";

import { FlowerPicture } from "@/components/flower";
import { flowerInfo, type FlowerId } from "@/lib/domain/flowers";
import { useState } from "react";
import Link from "next/link";
import { Check, Send } from "lucide-react";
import type { StudentState } from "@/lib/modules/sessions/state";
import { REFLECTION_QUESTIONS, REFLECTION_RATINGS } from "@/lib/domain/reflection";
import { api } from "@/lib/realtime/client";
import { Button } from "@/components/ui/button";
import { Card, Notice, Textarea } from "@/components/ui/primitives";
import { Buddy, useBuddy } from "@/components/buddy";
import { cn } from "@/lib/utils";

/** Post-lesson reflection (spec §24): anchored 1–5 scales + optional free text. */
export function Reflection({ sessionId, state }: { sessionId: string; state: StudentState }) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(state.reflectionDone);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const bloomBuddy = useBuddy();
  const required = REFLECTION_RATINGS.filter((r) => !("allowNa" in r && r.allowNa));
  const complete = required.every((r) => ratings[r.key]);

  if (done) {
    return (
      <div className="mx-auto w-full flex max-w-xl flex-col items-center gap-5 py-10 text-center">
        <Buddy who="bloom" size={110} mood="celebrate" cue={bloomBuddy.cue} />
        <p className="font-display text-2xl font-semibold">Thanks for reflecting!</p>
        <p className="text-ink-muted">Only your teacher can see your answers. You can look back at this lesson any time from Past lessons.</p>
        {state.group?.flower ? <GardenNote flower={state.group.flower} /> : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild><Link href={`/student/past/${state.session.id}`}>Look back at your work</Link></Button>
          <Button asChild variant="secondary"><Link href="/student">Back to home</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <form className="mx-auto w-full flex max-w-2xl flex-col gap-6 py-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!complete) { setError("Please answer each rating question (the AI one is optional)."); return; }
      setPending(true);
      setError(null);
      try {
        await api("/api/live/student", { method: "POST", json: { action: "reflection", sessionId, ratings: { ...Object.fromEntries(REFLECTION_RATINGS.map((r) => [r.key, 0])), ...ratings }, answers } });
        bloomBuddy.fire("cheer");
        setDone(true);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setPending(false);
      }
    }}>
      <div className="flex items-end gap-3">
        <Buddy who="bloom" size={72} mood="happy" cue={bloomBuddy.cue} listening={bloomBuddy.listening} />
        <div className="rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 shadow-soft">
          <p className="font-display text-xl font-semibold">The lesson has ended — how did it go?</p>
          <p className="text-ink-muted">A few quick questions. Only your teacher sees your answers; they&apos;re never shown to the class.</p>
        </div>
      </div>
      {state.group?.flower ? <GardenNote flower={state.group.flower} /> : null}
      {REFLECTION_RATINGS.map((r) => (
        <Card key={r.key} className="p-5">
          <fieldset>
            <legend className="mb-3 font-semibold">{r.question}{"allowNa" in r && r.allowNa ? <span className="font-normal text-ink-muted"> (optional)</span> : null}</legend>
            <div className="flex items-stretch gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className={cn("relative flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 py-3 text-lg font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]", ratings[r.key] === n ? "border-teal bg-teal text-white" : "border-line bg-surface hover:border-line-strong")}>
                  <input type="radio" className="sr-only" name={r.key} value={n} checked={ratings[r.key] === n} onChange={() => { setRatings({ ...ratings, [r.key]: n }); bloomBuddy.fire("nod"); }} aria-label={`${n}${n === 1 ? ` — ${r.low}` : n === 5 ? ` — ${r.high}` : ""}`} />
                  {n}
                </label>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-ink-muted" aria-hidden="true"><span>{r.low}</span><span>{r.high}</span></div>
            {"allowNa" in r && r.allowNa ? (
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-ink-muted"><input type="checkbox" checked={ratings[r.key] === 0} onChange={(e) => setRatings((prev) => { const next = { ...prev }; if (e.target.checked) next[r.key] = 0; else delete next[r.key]; return next; })} />I didn&apos;t use it</label>
            ) : null}
          </fieldset>
        </Card>
      ))}
      {REFLECTION_QUESTIONS.map((q) => (
        <div key={q.key} className="flex flex-col gap-1.5">
          <label htmlFor={`rq-${q.key}`} className="font-semibold">{q.question} <span className="font-normal text-ink-muted">(optional — skip if you like)</span></label>
          <Textarea id={`rq-${q.key}`} rows={2} value={answers[q.key] ?? ""} onChange={(e) => { setAnswers({ ...answers, [q.key]: e.target.value }); bloomBuddy.listen(); }} maxLength={1000} />
        </div>
      ))}
      {error ? <Notice tone="coral" role="alert">{error}</Notice> : null}
      <Button type="submit" size="lg" pending={pending} className="self-end">{complete ? <Check /> : <Send />}Send reflection</Button>
    </form>
  );
}

function GardenNote({ flower }: { flower: FlowerId }) {
  const info = flowerInfo(flower);
  return (
    <Link href="/student#garden" className="flex items-center gap-3 self-center rounded-3xl border-2 border-white bg-gradient-to-r from-[#fff7e8] to-[#ffeef6] py-2 pl-2 pr-5 text-left shadow-soft hover:shadow-lift">
      <FlowerPicture id={flower} size={52} />
      <span className="flex flex-col leading-tight">
        <span className="text-xs font-bold uppercase tracking-wide text-purple">Your group&apos;s plant bloomed</span>
        <span className="font-display text-xl font-bold">{info.name} — added to your garden</span>
      </span>
    </Link>
  );
}
