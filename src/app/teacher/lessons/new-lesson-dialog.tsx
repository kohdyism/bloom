"use client";

import { useActionState, useState, useTransition } from "react";
import { FilePlus2, LayoutTemplate, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Notice, Select, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTrigger, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlay";
import { LESSON_TEMPLATES } from "@/lib/domain/templates";
import { createBlankAction, createFromTemplateAction, generateLessonAction, type GenerateState } from "./actions";

const EXAMPLE = "Create a 25-minute group activity where Year 8 students analyse a poem about loneliness, brainstorm interpretations, discuss evidence and write a collaborative response.";

export function NewLessonDialog({ classes }: { classes: { id: string; name: string }[] }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [genState, genAction, genPending] = useActionState<GenerateState, FormData>(generateLessonAction, {});
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button><Plus /> New lesson</Button>
      </DialogTrigger>
      <DialogContent title="Create a lesson" description="Everything stays editable afterwards." wide>
        <div className="mb-4 flex flex-col gap-1.5">
          <Label htmlFor="new-lesson-class">Class</Label>
          <Select id="new-lesson-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">No class yet</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <Tabs defaultValue="template">
          <TabsList aria-label="How to create the lesson">
            <TabsTrigger value="template"><LayoutTemplate aria-hidden="true" />Template</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles aria-hidden="true" />Describe it (AI)</TabsTrigger>
            <TabsTrigger value="blank"><FilePlus2 aria-hidden="true" />From scratch</TabsTrigger>
          </TabsList>
          <TabsContent value="template" className="mt-4">
            <ul className="grid gap-2 sm:grid-cols-2">
              {LESSON_TEMPLATES.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => start(() => createFromTemplateAction(t.key, classId || null))}
                    className="h-full w-full rounded-xl border border-line p-4 text-left transition-colors hover:border-teal hover:bg-teal-soft/40 disabled:opacity-60"
                  >
                    <span className="block font-semibold">{t.name}</span>
                    <span className="mt-1 block text-sm text-ink-muted">{t.summary}</span>
                  </button>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="ai" className="mt-4">
            <form action={genAction} className="flex flex-col gap-4">
              <input type="hidden" name="classId" value={classId} />
              <Field id="gen-desc" label="Describe the activity" hint="Include the topic, timing and what students should produce.">
                <Textarea name="description" rows={4} placeholder={EXAMPLE} required />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="gen-subject" label="Subject"><Input name="subject" /></Field>
                <Field id="gen-year" label="Year level"><Input name="yearLevel" placeholder="Year 8" /></Field>
                <Field id="gen-min" label="Minutes"><Input name="minutes" type="number" min={5} max={120} placeholder="25" /></Field>
              </div>
              <Notice tone="purple">The AI drafts a structure — learning goals, stages, instructions and timings. You review and edit it, then approve it before it can be used with a class. No student information is sent.</Notice>
              {genState.error ? <Notice tone="coral" role="alert">{genState.error}</Notice> : null}
              <Button type="submit" pending={genPending} className="self-end"><Sparkles />Draft lesson</Button>
            </form>
          </TabsContent>
          <TabsContent value="blank" className="mt-4">
            <p className="mb-4 text-ink-muted">Start with a single orientation stage and add the building blocks you need.</p>
            <Button pending={pending} onClick={() => start(() => createBlankAction(classId || null))}><FilePlus2 />Start from scratch</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
