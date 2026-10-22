import Link from "next/link";
import { Users, BookOpen, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listClasses } from "@/lib/modules/classes";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { CreateClassDialog } from "./create-class-dialog";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const user = await requireUser("teacher");
  const classes = await listClasses(user.id);
  return (
    <>
      <PageHeader title="Classes & students" description="Your classes, enrolled students and grouping restrictions." actions={<CreateClassDialog />} />
      {classes.length === 0 ? (
        <EmptyState title="No classes yet" action={<CreateClassDialog />}>Create a class to start enrolling students.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <li key={c.id}>
              <Link href={`/teacher/classes/${c.id}`} className="group block rounded-2xl">
                <Card className="h-full p-5 transition-shadow group-hover:shadow-lift">
                  <p className="text-sm font-semibold text-teal">{[c.yearLevel, c.subject].filter(Boolean).join(" · ") || "Class"}</p>
                  <h2 className="mt-1 font-display text-lg font-semibold">{c.name}</h2>
                  <div className="mt-4 flex items-center gap-4 text-sm text-ink-muted">
                    <span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden="true" />{c.studentCount} students</span>
                    <span className="inline-flex items-center gap-1.5"><BookOpen className="size-4" aria-hidden="true" />{c.lessonCount} lessons</span>
                    <ChevronRight className="ml-auto size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
