"use client";

import { useActionState, useTransition } from "react";
import { Trash2, Link2Off, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, Label, Notice, Select } from "@/components/ui/primitives";
import { addConstraintAction, removeConstraintAction, type FormState } from "../actions";

type Props = {
  classId: string;
  students: { id: string; name: string }[];
  constraints: { id: string; kind: "keep_apart" | "keep_together"; studentA: string; studentB: string }[];
};

export function ConstraintsPanel({ classId, students, constraints }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(addConstraintAction.bind(null, classId), {});
  const [removing, start] = useTransition();
  const name = (id: string) => students.find((s) => s.id === id)?.name ?? "Former student";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Grouping restrictions</CardTitle>
        <p className="text-sm text-ink-muted">Private to you. “Keep apart” is always respected when Bloom suggests groups.</p>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {constraints.length ? (
          <ul className="flex flex-col gap-2">
            {constraints.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                {c.kind === "keep_apart" ? <Link2Off className="size-4 text-coral" aria-hidden="true" /> : <Link2 className="size-4 text-teal" aria-hidden="true" />}
                <span className="flex-1"><strong>{name(c.studentA)}</strong> {c.kind === "keep_apart" ? "kept apart from" : "kept with"} <strong>{name(c.studentB)}</strong></span>
                <Button variant="ghost" size="icon" aria-label="Remove restriction" disabled={removing} onClick={() => start(() => removeConstraintAction(classId, c.id))}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ink-muted">No restrictions set.</p>}
        <form action={action} className="grid gap-3 border-t border-line pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5"><Label htmlFor="c-a">Student</Label>
              <Select id="c-a" name="studentA" defaultValue=""><option value="" disabled>Choose…</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="c-b">And</Label>
              <Select id="c-b" name="studentB" defaultValue=""><option value="" disabled>Choose…</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-1 flex-col gap-1.5"><Label htmlFor="c-kind">Rule</Label>
              <Select id="c-kind" name="kind" defaultValue="keep_apart"><option value="keep_apart">Keep apart (always respected)</option><option value="keep_together">Prefer together</option></Select></div>
            <Button type="submit" variant="secondary" pending={pending}>Add rule</Button>
          </div>
          {state.error ? <Notice tone="coral" role="alert">{state.error}</Notice> : null}
        </form>
      </CardBody>
    </Card>
  );
}
