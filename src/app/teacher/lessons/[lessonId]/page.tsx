import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getLesson } from "@/lib/modules/lessons";
import { listClasses } from "@/lib/modules/classes";
import { NotFoundError } from "@/lib/db";
import { LessonBuilder } from "./lesson-builder";

export const metadata = { title: "Lesson builder" };

export default async function LessonPage({ params, searchParams }: { params: Promise<{ lessonId: string }>; searchParams: Promise<{ generated?: string; note?: string }> }) {
  const user = await requireUser("teacher");
  const { lessonId } = await params;
  const { generated, note } = await searchParams;
  const [lesson, classes] = await Promise.all([
    getLesson(user.id, lessonId).catch((e) => {
      if (e instanceof NotFoundError || (e as { code?: string }).code === "22P02") notFound();
      throw e;
    }),
    listClasses(user.id),
  ]);
  const { id, classId, isTemplate, source, needsApproval, materials, ...draft } = lesson;
  return (
    <LessonBuilder
      lessonId={id}
      initialDraft={draft}
      initialClassId={classId}
      classes={classes.map((c) => ({ id: c.id, name: c.name }))}
      materials={materials.map((m) => ({ id: m.id, kind: m.kind, title: m.title, body: m.body.slice(0, 600), hasFile: !!m.storagePath }))}
      isTemplate={isTemplate}
      source={source}
      needsApproval={needsApproval}
      generatedOrigin={generated as "ai" | "ai_simulated" | "offline_helper" | undefined}
      generatedNote={note}
    />
  );
}
