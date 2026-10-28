import { requireUser } from "@/lib/auth/current-user";
import { listLessons } from "@/lib/modules/lessons";
import { listClasses } from "@/lib/modules/classes";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { NewLessonDialog } from "./new-lesson-dialog";
import { LessonLibrary } from "./library";

export const metadata = { title: "Lesson library" };

export default async function LessonsPage() {
  const user = await requireUser("teacher");
  const [lessons, classes] = await Promise.all([listLessons(user.id), listClasses(user.id)]);
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
      ) : null}
      {lessons.length ? <LessonLibrary lessons={lessons} /> : null}
    </>
  );
}
