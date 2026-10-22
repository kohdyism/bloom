"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/primitives";
import { signInAction, type SignInState } from "./actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, {});
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field id="username" label="Username" error={state.fieldErrors?.username}>
        <Input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required defaultValue={state.username} />
      </Field>
      <Field id="password" label="Password" error={state.fieldErrors?.password}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error ? <Notice tone="coral" role="alert">{state.error}</Notice> : null}
      <Button type="submit" size="lg" pending={pending}>Sign in</Button>
    </form>
  );
}
