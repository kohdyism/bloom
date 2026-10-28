import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getStudentDetail } from "@/lib/modules/classes";
import { NotFoundError } from "@/lib/db";
import { SURVEY_QUESTIONS, surveyLabel } from "@/lib/domain/students";
import { Avatar, Badge, Card, CardBody, CardHeader, CardTitle, Notice } from "@/components/ui/primitives";
import { AccommodationEditor } from "./accommodation-editor";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Student profile" };

export default async function StudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const user = await requireUser("teacher");
  const { studentId } = await params;
  const s = await getStudentDetail(user.id, studentId).catch((e) => {
    if (e instanceof NotFoundError || (e as { code?: string }).code === "22P02") notFound();
    throw e;
  });
  const backClass = s.classes[0];
  return (
    <>
      {backClass ? (
        <Link href={`/teacher/classes/${backClass.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" />{backClass.name}</Link>
      ) : null}
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={s.displayName} color={s.avatarColor} size="lg" />
        <div>
          <h1 className="font-display text-2xl font-bold">{s.displayName}</h1>
          <p className="text-ink-muted">@{s.username} · {s.classes.map((c) => c.name).join(", ")}</p>
        </div>
        <Button asChild variant="secondary" className="ml-auto"><Link href={`/print/student/${s.id}`}><FileDown />Progress report (PDF)</Link></Button>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Working preferences</CardTitle>
            <p className="text-sm text-ink-muted">What {s.displayName.split(" ")[0]} told Canopy in their own survey. They can change these at any time.</p>
          </CardHeader>
          <CardBody>
            {!s.onboarded ? <Notice tone="amber">Hasn’t completed the survey yet — it appears the first time they sign in.</Notice> : (
              <dl className="grid gap-3">
                {SURVEY_QUESTIONS.map((q) => (
                  <div key={q.key} className="grid gap-0.5 sm:grid-cols-[1fr_auto] sm:gap-4">
                    <dt className="text-sm text-ink-muted">{q.question}</dt>
                    <dd className="text-sm font-semibold">{surveyLabel(q.key, s.survey[q.key])}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardBody>
        </Card>
        <Card className="border-purple/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Support settings</CardTitle>
              <Badge tone="purple"><Lock aria-hidden="true" />Private</Badge>
            </div>
            <p className="text-sm text-ink-muted">
              Functional supports shape grouping and pacing quietly. They are never shown to other students, on the classroom display, or in group AI messages.
              The student can see which supports are switched on for them, but never your notes.
            </p>
          </CardHeader>
          <CardBody>
            <AccommodationEditor studentId={s.id} initial={s.accommodations} note={s.note} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
