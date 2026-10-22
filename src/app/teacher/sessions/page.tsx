import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { listReports } from "@/lib/modules/reports";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Live sessions" };

export default async function SessionsPage() {
  const user = await requireUser("teacher");
  const sessions = await listReports(user.id);
  return (
    <>
      <PageHeader title="Live sessions" description="Lessons you've launched. Launch a new one from the lesson builder." actions={<Button asChild><Link href="/teacher/lessons">Choose a lesson</Link></Button>} />
      {sessions.length === 0 ? <EmptyState title="No sessions yet">Open a lesson and press “Launch lesson”.</EmptyState> : (
        <Card>
          <ul className="divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <Link href={s.status === "ended" ? `/teacher/reports/${s.id}` : `/teacher/sessions/${s.id}`} className="font-semibold hover:underline">{s.title}</Link>
                  <p className="text-sm text-ink-muted">{s.className} · {new Date(s.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {s.participants} joined</p>
                </div>
                <Badge tone={s.status === "active" ? "teal" : s.status === "lobby" ? "blue" : s.status === "paused" ? "amber" : "neutral"}>{s.status === "lobby" ? "In lobby" : s.status === "active" ? "Live" : s.status === "paused" ? "Paused" : "Ended"}</Badge>
                {s.status === "ended" ? <Button asChild size="sm" variant="soft"><Link href={`/teacher/reports/${s.id}`}>Report</Link></Button> : <Button asChild size="sm"><Link href={`/teacher/sessions/${s.id}`}>Open</Link></Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
