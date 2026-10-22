"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { enrolStudentAction, type FormState } from "../actions";

export function EnrolStudentDialog({ classId }: { classId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(enrolStudentAction.bind(null, classId), {});
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button><UserPlus /> Enrol student</Button>
      </DialogTrigger>
      <DialogContent title="Enrol a student" description="Creates a teacher-managed account. Students can't sign themselves up.">
        <form action={action} className="flex flex-col gap-4" key={state.ok ? state.message : "form"}>
          <Field id="enrol-name" label="Name shown in class" error={state.fieldErrors?.displayName}>
            <Input name="displayName" required />
          </Field>
          <Field id="enrol-username" label="Username" hint="Lowercase, e.g. first name and initial: sam.j" error={state.fieldErrors?.username}>
            <Input name="username" required autoCapitalize="none" spellCheck={false} />
          </Field>
          <Field id="enrol-password" label="Starting password" hint="At least 8 characters." error={state.fieldErrors?.password}>
            <Input name="password" type="text" required autoComplete="off" />
          </Field>
          {state.message ? <Notice tone="teal" role="status">{state.message}</Notice> : null}
          <Button type="submit" pending={pending} className="self-end">Enrol</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
