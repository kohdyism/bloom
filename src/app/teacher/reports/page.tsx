import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { listReports } from "@/lib/modules/reports";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await requireUser("teacher");
  const sessions = (await listReports(user.id)).filter((s) => s.status === "ended");
  return (
    <>
      <PageHeader title="Lesson reports" description="Generated after you end a lesson. Reports describe groups and the lesson process — never diagnoses, scores or rankings of students." />
      {sessions.length === 0 ? <EmptyState title="No reports yet">End a live lesson to see its report here.</EmptyState> : (
        <Card>
          <ul className="divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-ink-muted">{s.className} · {s.endedAt ? new Date(s.endedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : ""} · {s.participants} took part · {s.reflections} reflections</p>
                </div>
                <Button asChild size="sm" variant="soft"><Link href={`/teacher/reports/${s.id}`}>Open report</Link></Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
