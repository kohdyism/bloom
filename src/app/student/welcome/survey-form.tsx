"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MascotSays } from "@/components/mascot";
import { StepDots, Notice } from "@/components/ui/primitives";
import { ACCOMMODATIONS, SURVEY_QUESTIONS, type Survey } from "@/lib/domain/students";
import { cn } from "@/lib/utils";
import { saveSurveyAction } from "../actions";

/**
 * First-time working-preferences survey: one question at a time to keep the
 * load low. Every question is optional; nothing asks about diagnoses or about
 * other students.
 */
export function SurveyForm({ name, initial, editing, supports }: { name: string; initial: Survey; editing: boolean; supports: string[] }) {
  const [answers, setAnswers] = useState<Survey>(initial);
  const [step, setStep] = useState(editing ? 1 : 0);
  const [pending, start] = useTransition();
  const total = SURVEY_QUESTIONS.length;
  const q = SURVEY_QUESTIONS[step - 1];

  if (step === 0) {
    return (
      <div className="flex flex-col gap-6">
        <MascotSays mood="wave" size={80}>
          <p className="font-display text-2xl font-semibold">Hi {name}, I&apos;m Sprout.</p>
          <p className="mt-1 text-ink-muted">Before we start, a few quick questions about how you like to work in groups. There are no right answers, you can skip any of them, and you can change them later.</p>
        </MascotSays>
        <Notice tone="teal">Your answers help Bloom and your teacher set up groups and tasks that suit you. Other students don&apos;t see them.</Notice>
        <Button size="lg" className="self-start" onClick={() => setStep(1)}>Let&apos;s go <ArrowRight /></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">{editing ? "My working preferences" : "How you like to work"}</h1>
        <StepDots total={total} current={step - 1} label={`Question ${step} of ${total}`} />
      </div>
      <fieldset className="flex flex-col gap-3" key={q.key}>
        <legend className="mb-3 font-display text-2xl font-semibold">{q.question}</legend>
        {q.options.map((o) => {
          const selected = answers[q.key] === o.value;
          return (
            <label key={o.value} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-[1.05rem] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]", selected ? "border-teal bg-teal-soft" : "border-line bg-surface hover:border-line-strong")}>
              <input type="radio" className="sr-only" name={q.key} value={o.value} checked={selected} onChange={() => setAnswers({ ...answers, [q.key]: o.value })} />
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-teal bg-teal text-white" : "border-line-strong")} aria-hidden="true">{selected ? <Check className="size-4" /> : null}</span>
              {o.label}
            </label>
          );
        })}
      </fieldset>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={editing && step === 1}><ArrowLeft />Back</Button>
        <div className="flex gap-2">
          {step < total ? (
            <>
              <Button variant="ghost" onClick={() => setStep(step + 1)}>Skip</Button>
              <Button onClick={() => setStep(step + 1)}>Next <ArrowRight /></Button>
            </>
          ) : (
            <Button pending={pending} onClick={() => start(() => saveSurveyAction(answers, "/student"))}><Check />{editing ? "Save" : "Finish"}</Button>
          )}
        </div>
      </div>
      {editing && supports.length ? (
        <Notice title="Supports your teacher has switched on for you">
          <ul className="mt-1 list-disc pl-5">{supports.map((s) => <li key={s}>{ACCOMMODATIONS[s as keyof typeof ACCOMMODATIONS]?.short ?? s}</li>)}</ul>
          <p className="mt-1">These quietly shape things like group size and timing. Talk to your teacher if you&apos;d like anything changed.</p>
        </Notice>
      ) : null}
    </div>
  );
}
