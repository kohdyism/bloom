"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { createClassAction, type FormState } from "./actions";

export function CreateClassDialog() {
  const [state, action, pending] = useActionState<FormState, FormData>(createClassAction, {});
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button><Plus /> New class</Button>
      </DialogTrigger>
      <DialogContent title="Create a class" description="For example, “Year 8 Literature — Class 1”.">
        <form action={action} className="flex flex-col gap-4">
          <Field id="class-name" label="Class name" error={state.fieldErrors?.name}>
            <Input name="name" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="class-subject" label="Subject"><Input name="subject" /></Field>
            <Field id="class-year" label="Year level"><Input name="yearLevel" placeholder="Year 8" /></Field>
          </div>
          <Button type="submit" pending={pending} className="self-end">Create class</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
