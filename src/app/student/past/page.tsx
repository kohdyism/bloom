import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { pastLessons } from "@/lib/modules/past-lessons";
import { FlowerPicture } from "@/components/flower";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";

export const metadata = { title: "Past lessons" };

export default async function PastLessonsPage() {
  const user = await requireUser("student");
  const lessons = await pastLessons(user.id);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold"><BookOpen className="size-7 text-purple" aria-hidden="true" />Past lessons</h1>
        <p className="mt-1 text-ink-muted">Look back at what your groups made, the ideas you had, and how it went.</p>
      </div>
      {lessons.length === 0 ? <EmptyState title="No past lessons yet">When a lesson you took part in ends, it will appear here.</EmptyState> : (
        <ul className="flex flex-col gap-2">
          {lessons.map((l) => (
            <li key={l.id}>
              <Link href={`/student/past/${l.id}`} className="group block rounded-2xl">
                <Card className="flex items-center gap-3 p-3 transition-shadow group-hover:shadow-lift sm:p-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-mint-soft">
                    {l.flower ? <FlowerPicture id={l.flower} size={34} /> : <BookOpen className="size-6 text-mint" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{l.title}</p>
                    <p className="truncate text-sm text-ink-muted">{l.className}{l.groupName ? ` · Group ${l.groupName}` : ""}{l.endedAt ? ` · ${new Date(l.endedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</p>
                    {l.reflected ? null : <Badge tone="purple" className="mt-1">Reflection waiting</Badge>}
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
