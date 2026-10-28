import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb, MessagesSquare, NotebookPen, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { uuid } from "@/lib/api";
import { studentState, studentOwnSubmission } from "@/lib/modules/sessions/state";
import { myLookBack } from "@/lib/modules/past-lessons";
import { FLOWERS } from "@/lib/domain/flowers";
import { FlowerPicture } from "@/components/flower";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import type { SubmissionContent } from "@/components/live/submission-view";
import { PastWork } from "./past-work";
import { NoteForm } from "./note-form";

export const metadata = { title: "Looking back" };

export default async function LookBackPage(props: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser("student");
  const parsed = uuid.safeParse((await props.params).sessionId);
  if (!parsed.success) notFound();
  const sessionId = parsed.data;
  const state = await studentState(user.id, sessionId).catch(() => null);
  if (!state || state.session.status !== "ended") notFound();
  const [own, look] = await Promise.all([studentOwnSubmission(user.id, sessionId), myLookBack(user.id, sessionId)]);
  const g = state.group;
  const flower = g?.flower ? FLOWERS.find((f) => f.id === g.flower) : null;
  const myIdeas = g?.ideas.mine.filter((i) => i.status === "submitted") ?? [];
  const groupIdeas = g?.ideas.shared.filter((i) => !i.mine) ?? [];
  const chat = g?.messages.filter((m) => m.kind === "student" || m.kind === "teacher") ?? [];
  const set = state.session.reflection;
  const answered = set.questions.filter((q) => look.reflection?.answers[q.key]?.trim());

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:py-8">
      <Link href="/student/past" className="inline-flex w-fit items-center gap-1.5 rounded-lg text-sm font-semibold text-teal hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />Past lessons</Link>

      <Card className="flex items-center gap-4 p-4 sm:p-5">
        {g?.flower ? <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-mint-soft"><FlowerPicture id={g.flower} size={48} /></span> : null}
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{state.session.title}</h1>
          <p className="text-ink-muted">{g ? `You worked in Group ${g.name}` : "You took part in this lesson"}{flower ? ` · your group grew a ${flower.name}` : ""}</p>
        </div>
      </Card>

      <section aria-labelledby="work-h" className="flex flex-col gap-3">
        <h2 id="work-h" className="flex items-center gap-2 font-display text-xl font-semibold"><Sparkles className="size-5 text-purple" aria-hidden="true" />What your group made</h2>
        <Card className="p-4">{own ? <PastWork id={own.id} content={own.content as SubmissionContent} note={own.note} /> : <p className="text-ink-muted">Your group didn&apos;t hand anything in for this lesson.</p>}</Card>
      </section>

      <section aria-labelledby="ideas-h" className="flex flex-col gap-3">
        <h2 id="ideas-h" className="flex items-center gap-2 font-display text-xl font-semibold"><Lightbulb className="size-5 text-amber" aria-hidden="true" />Ideas</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-2 font-semibold">Your ideas</h3>
            {myIdeas.length ? <ul className="flex flex-col gap-1.5">{myIdeas.map((i) => <li key={i.id} className="rounded-xl bg-sun-soft px-3 py-2">{i.body}</li>)}</ul> : <p className="text-sm text-ink-muted">No ideas saved.</p>}
          </Card>
          <Card className="p-4">
            <h3 className="mb-2 font-semibold">Your group&apos;s ideas</h3>
            {groupIdeas.length ? <ul className="flex flex-col gap-1.5">{groupIdeas.map((i) => <li key={i.id} className="rounded-xl bg-surface-2 px-3 py-2">{i.body}<span className="block text-xs text-ink-muted">{i.author}</span></li>)}</ul> : <p className="text-sm text-ink-muted">No shared ideas.</p>}
          </Card>
        </div>
      </section>

      {chat.length ? (
        <details className="group rounded-[1.75rem] border-2 border-white bg-white/95 p-4 shadow-soft">
          <summary className="flex cursor-pointer items-center gap-2 font-display text-lg font-semibold"><MessagesSquare className="size-5 text-teal" aria-hidden="true" />Group chat ({chat.length} messages)</summary>
          <ol className="mt-3 flex max-h-96 flex-col gap-1.5 overflow-y-auto">
            {chat.map((m) => <li key={m.id} className="text-sm"><span className="font-semibold">{m.authorId === user.id ? "You" : m.author}:</span> {m.body}</li>)}
          </ol>
        </details>
      ) : null}

      <section aria-labelledby="reflect-h" className="flex flex-col gap-3">
        <h2 id="reflect-h" className="flex items-center gap-2 font-display text-xl font-semibold"><NotebookPen className="size-5 text-coral" aria-hidden="true" />How it went</h2>
        <Card className="flex flex-col gap-4 p-4">
          {look.reflection ? (
            <>
              <ul className="grid gap-2 sm:grid-cols-2">
                {set.ratings.map((r) => {
                  const v = look.reflection!.ratings[r.key];
                  if (!v) return null;
                  return (
                    <li key={r.key} className="rounded-xl bg-surface-2 px-3 py-2">
                      <p className="text-sm">{r.question}</p>
                      <p className="mt-1 flex items-center gap-1" aria-label={`${v} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <span key={n} aria-hidden="true" className={n <= v ? "size-3 rounded-full bg-purple" : "size-3 rounded-full bg-line-strong/50"} />)}<span className="ml-1.5 text-xs text-ink-muted">{v <= 2 ? r.low : v >= 4 ? r.high : "In between"}</span></p>
                    </li>
                  );
                })}
              </ul>
              {answered.map((q) => <div key={q.key}><p className="text-sm font-semibold">{q.question}</p><p className="whitespace-pre-line">{look.reflection!.answers[q.key]}</p></div>)}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1">You haven&apos;t reflected on this lesson yet.</p>
              <Button asChild><Link href={`/student/session/${sessionId}`}>Reflect now</Link></Button>
            </div>
          )}
          <div className="border-t border-line pt-4"><NoteForm sessionId={sessionId} initial={look.note?.body ?? ""} /></div>
        </Card>
      </section>
    </div>
  );
}
