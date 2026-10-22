import Link from "next/link";
import { ArrowRight, BookOpen, Radio, Users, BarChart3, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listClasses } from "@/lib/modules/classes";
import { listLessons } from "@/lib/modules/lessons";
import { listReports } from "@/lib/modules/reports";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { MascotSays } from "@/components/mascot";
import { minutesLabel } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const STATUS: Record<string, { label: string; tone: "teal" | "amber" | "blue" | "neutral" }> = {
  lobby: { label: "In lobby", tone: "blue" },
  active: { label: "Live", tone: "teal" },
  paused: { label: "Paused", tone: "amber" },
  ended: { label: "Ended", tone: "neutral" },
};

export default async function TeacherDashboard() {
  const user = await requireUser("teacher");
  const [classes, lessons, sessions] = await Promise.all([listClasses(user.id), listLessons(user.id), listReports(user.id)]);
  const live = sessions.filter((s) => s.status !== "ended");
  const recent = sessions.filter((s) => s.status === "ended").slice(0, 5);
  const firstName = user.displayName;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <MascotSays mood="wave" size={64}>
          <p className="font-display text-xl font-semibold">Good to see you, {firstName}.</p>
          <p className="text-ink-muted">
            {live.length ? `You have ${live.length} lesson${live.length === 1 ? "" : "s"} running or waiting in the lobby.` : "Pick a lesson from your library when you're ready to launch one."}
          </p>
        </MascotSays>
        <div className="flex gap-2">
          <Button asChild variant="secondary"><Link href="/teacher/lessons"><BookOpen />Lesson library</Link></Button>
        </div>
      </div>

      {live.length ? (
        <section aria-labelledby="live-heading">
          <h2 id="live-heading" className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Radio className="size-5 text-teal" aria-hidden="true" />Active sessions</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {live.map((s) => (
              <li key={s.id}>
                <Link href={`/teacher/sessions/${s.id}`} className="group block rounded-2xl">
                  <Card className="flex items-center gap-4 border-teal/40 p-4 transition-shadow group-hover:shadow-lift">
                    <span className="relative flex size-3" aria-hidden="true">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal opacity-40" />
                      <span className="relative inline-flex size-3 rounded-full bg-teal" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.title}</p>
                      <p className="text-sm text-ink-muted">{s.className} · {s.participants} joined</p>
                    </div>
                    <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                    <ArrowRight className="size-4 text-ink-muted" aria-hidden="true" />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><BookOpen className="size-5 text-blue" aria-hidden="true" />Lesson library</CardTitle>
            <Link href="/teacher/lessons" className="text-sm font-semibold text-teal hover:underline">See all</Link>
          </CardHeader>
          <CardBody>
            {lessons.length === 0 ? <EmptyState title="No lessons yet">Create one from a template or describe it to the AI.</EmptyState> : (
              <ul className="divide-y divide-line">
                {lessons.filter((l) => !l.isTemplate).slice(0, 5).map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/teacher/lessons/${l.id}`} className="font-semibold hover:underline">{l.title}</Link>
                      <p className="text-sm text-ink-muted">{l.className ?? "No class"} · {l.stageCount} stages · {minutesLabel(l.totalSeconds)}</p>
                    </div>
                    {l.needsApproval ? <Badge tone="amber"><Sparkles aria-hidden="true" />Review AI draft</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Users className="size-5 text-purple" aria-hidden="true" />My classes</CardTitle>
            <Link href="/teacher/classes" className="text-sm font-semibold text-teal hover:underline">Manage</Link>
          </CardHeader>
          <CardBody>
            <ul className="flex flex-col gap-2">
              {classes.map((c) => (
                <li key={c.id}>
                  <Link href={`/teacher/classes/${c.id}`} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 hover:bg-teal-soft/50">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-sm text-ink-muted">{c.studentCount}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><BarChart3 className="size-5 text-mint" aria-hidden="true" />Recent lessons and reports</CardTitle>
          <Link href="/teacher/reports" className="text-sm font-semibold text-teal hover:underline">All reports</Link>
        </CardHeader>
        <CardBody>
          {recent.length === 0 ? <p className="text-sm text-ink-muted">Reports appear here after you end a lesson.</p> : (
            <ul className="divide-y divide-line">
              {recent.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-sm text-ink-muted">{s.className} · {s.endedAt ? new Date(s.endedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""} · {s.reflections} reflections</p>
                  </div>
                  <Button asChild variant="soft" size="sm"><Link href={`/teacher/reports/${s.id}`}>View report</Link></Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
