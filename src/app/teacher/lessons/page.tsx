import { requireUser } from "@/lib/auth/current-user";
import { listFolders, listLessons } from "@/lib/modules/lessons";
import { listClasses } from "@/lib/modules/classes";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { NewLessonDialog } from "./new-lesson-dialog";
import { LessonLibrary, type LibraryView } from "./library";

export const metadata = { title: "Lesson library" };

export default async function LessonsPage(props: { searchParams: Promise<{ in?: string; folder?: string }> }) {
  const user = await requireUser("teacher");
  const [lessons, classes, folders, sp] = await Promise.all([listLessons(user.id), listClasses(user.id), listFolders(user.id), props.searchParams]);
  const view: LibraryView =
    sp.folder && folders.some((f) => f.id === sp.folder) ? { place: "folder", folderId: sp.folder }
      : sp.in === "templates" ? { place: "templates" }
      : sp.in === "none" ? { place: "class", classId: null }
      : sp.in && classes.some((c) => c.id === sp.in) ? { place: "class", classId: sp.in }
      : { place: "root" };
  const dialogClasses = classes.map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <PageHeader
        title="Lesson library"
        description="Lessons are grouped by class. Inside a class, make your own folders — or leave lessons loose."
        actions={<NewLessonDialog classes={dialogClasses} />}
      />
      {lessons.length === 0 && classes.length === 0 ? (
        <EmptyState title="No lessons yet" action={<NewLessonDialog classes={dialogClasses} />}>
          Start with a template like Think–Pair–Share, or describe your activity and let the AI draft it.
        </EmptyState>
      ) : (
        <LessonLibrary lessons={lessons} classes={dialogClasses} folders={folders} view={view} />
      )}
    </>
  );
}
