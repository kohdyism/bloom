import Link from "next/link";
import { Clock, Layers, Sparkles, Bookmark } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listLessons } from "@/lib/modules/lessons";
import { listClasses } from "@/lib/modules/classes";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { minutesLabel } from "@/lib/utils";
import { NewLessonDialog } from "./new-lesson-dialog";

export const metadata = { title: "Lesson library" };

export default async function LessonsPage() {
  const user = await requireUser("teacher");
  const [lessons, classes] = await Promise.all([listLessons(user.id), listClasses(user.id)]);
  const templates = lessons.filter((l) => l.isTemplate);
  const regular = lessons.filter((l) => !l.isTemplate);
  return (
    <>
      <PageHeader
        title="Lesson library"
        description="Build cooperative activities from a template, from scratch, or by describing them to the AI."
        actions={<NewLessonDialog classes={classes.map((c) => ({ id: c.id, name: c.name }))} />}
      />
      {regular.length === 0 ? (
        <EmptyState title="No lessons yet" action={<NewLessonDialog classes={classes.map((c) => ({ id: c.id, name: c.name }))} />}>
          Start with a template like Think–Pair–Share, or describe your activity and let the AI draft it.
        </EmptyState>
      ) : (
        <LessonGrid lessons={regular} />
      )}
      {templates.length ? (
        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Bookmark className="size-5 text-purple" aria-hidden="true" />Your saved templates</h2>
          <LessonGrid lessons={templates} />
        </section>
      ) : null}
    </>
  );
}

function LessonGrid({ lessons }: { lessons: Awaited<ReturnType<typeof listLessons>> }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {lessons.map((l) => (
        <li key={l.id}>
          <Link href={`/teacher/lessons/${l.id}`} className="group block h-full rounded-2xl">
            <Card className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-lift">
              <div className="flex flex-wrap gap-1.5">
                {l.className ? <Badge tone="teal">{l.className}</Badge> : <Badge>No class</Badge>}
                {l.needsApproval ? <Badge tone="amber"><Sparkles aria-hidden="true" />AI draft — needs review</Badge> : null}
                {l.source === "ai" && !l.needsApproval ? <Badge tone="purple"><Sparkles aria-hidden="true" />AI-assisted</Badge> : null}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">{l.title}</h3>
              <p className="text-sm text-ink-muted">{[l.yearLevel, l.subject].filter(Boolean).join(" · ")}</p>
              <div className="mt-auto flex gap-4 pt-4 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-1.5"><Layers className="size-4" aria-hidden="true" />{l.stageCount} stages</span>
                <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden="true" />{minutesLabel(l.totalSeconds)}</span>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
