import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getClass } from "@/lib/modules/classes";
import { NotFoundError } from "@/lib/db";
import { Avatar, Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { EnrolStudentDialog } from "./enrol-student-dialog";
import { ConstraintsPanel } from "./constraints-panel";
import { RemoveStudentButton } from "./remove-student-button";

export default async function ClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const user = await requireUser("teacher");
  const { classId } = await params;
  const cls = await getClass(user.id, classId).catch((e) => {
    if (e instanceof NotFoundError || (e as { code?: string }).code === "22P02") notFound();
    throw e;
  });
  return (
    <>
      <Link href="/teacher/classes" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" />All classes</Link>
      <PageHeader
        eyebrow={[cls.yearLevel, cls.subject].filter(Boolean).join(" · ")}
        title={cls.name}
        description={`${cls.students.length} students enrolled`}
        actions={<EnrolStudentDialog classId={cls.id} />}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle>Students</CardTitle></CardHeader>
          <CardBody>
            {cls.students.length === 0 ? (
              <EmptyState title="No students yet">Enrol students to give them a teacher-managed account.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {cls.students.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <Avatar name={s.displayName} color={s.avatarColor} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/teacher/students/${s.id}`} className="font-semibold hover:underline">{s.displayName}</Link>
                      <p className="text-sm text-ink-muted">@{s.username}</p>
                    </div>
                    {!s.onboarded ? <Badge tone="amber">Survey not done</Badge> : null}
                    {s.accommodationCount > 0 ? (
                      <Badge tone="purple" title="Private — only visible to you"><ShieldCheck aria-hidden="true" />{s.accommodationCount} support{s.accommodationCount === 1 ? "" : "s"}</Badge>
                    ) : null}
                    <RemoveStudentButton classId={cls.id} studentId={s.id} name={s.displayName} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <div className="flex flex-col gap-6">
          <ConstraintsPanel classId={cls.id} students={cls.students.map((s) => ({ id: s.id, name: s.displayName }))} constraints={cls.constraints} />
          <Card>
            <CardHeader><CardTitle>Lessons for this class</CardTitle></CardHeader>
            <CardBody>
              {cls.lessons.length === 0 ? <p className="text-sm text-ink-muted">No lessons linked yet.</p> : (
                <ul className="flex flex-col gap-1">
                  {cls.lessons.map((l) => (
                    <li key={l.id}><Link className="text-teal hover:underline" href={`/teacher/lessons/${l.id}`}>{l.title}</Link></li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
