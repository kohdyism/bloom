"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Notice, Textarea } from "@/components/ui/primitives";
import { ACCOMMODATIONS, ACCOMMODATION_KINDS, type AccommodationKind } from "@/lib/domain/students";
import { saveAccommodationsAction, type FormState } from "@/app/teacher/classes/actions";

export function AccommodationEditor({ studentId, initial, note }: { studentId: string; initial: AccommodationKind[]; note: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAccommodationsAction.bind(null, studentId), {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Functional supports</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACCOMMODATION_KINDS.map((k) => (
            <label key={k} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line px-3 py-2.5 text-sm has-[:checked]:border-purple has-[:checked]:bg-purple-soft">
              <input type="checkbox" name="accommodations" value={k} defaultChecked={initial.includes(k)} className="mt-0.5 size-4 accent-[var(--purple)]" />
              {ACCOMMODATIONS[k].label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="private-note">Private teacher note</Label>
        <Textarea id="private-note" name="note" defaultValue={note} maxLength={4000} aria-describedby="private-note-hint" />
        <p id="private-note-hint" className="text-sm text-ink-muted">Only you can read this. It is never sent to the AI. Avoid diagnoses — describe what helps.</p>
      </div>
      {state.message ? <Notice tone="teal" role="status">{state.message}</Notice> : null}
      <Button type="submit" pending={pending} className="self-end">Save support settings</Button>
    </form>
  );
}
