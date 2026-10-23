import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Settings2 } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { asServer, asUser } from "@/lib/db";
import { isFlowerId } from "@/lib/domain/flowers";
import { Garden, type GardenEntry } from "./garden";
import { MascotSays } from "@/components/mascot";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { JoinForm } from "./join-form";

export const metadata = { title: "Home" };

export default async function StudentHome() {
  const user = await requireUser("student");
  if (!user.onboarded) redirect("/student/welcome");
  const sessions = await asUser(user.id, (db) =>
    db.query<{ id: string; title: string; status: string; class_name: string; reflected: boolean }>(
      `select s.id, s.snapshot ->> 'title' as title, s.status, c.name as class_name,
              exists (select 1 from reflection_responses r where r.session_id = s.id and r.student_id = $1) as reflected
       from session_participants p join activity_sessions s on s.id = p.session_id join classes c on c.id = s.class_id
       where p.student_id = $1 and (s.status <> 'ended' or s.ended_at > now() - interval '3 days')
       order by s.created_at desc limit 10`,
      [user.id],
    ),
  );
  // Read on the server for this student only (their own groups).
  const garden: GardenEntry[] = (await asServer((db) =>
    db.query<{ flower: string; lesson: string; group_name: string; at: Date }>(
      `select g.flower, s.snapshot ->> 'title' as lesson, g.name as group_name, coalesce(s.ended_at, g.updated_at) as at
       from group_members gm join session_groups g on g.id = gm.group_id join activity_sessions s on s.id = g.session_id
       where gm.student_id = $1 and g.flower is not null order by at`,
      [user.id],
    ),
  )).filter((r) => isFlowerId(r.flower)).map((r) => ({ flower: r.flower as GardenEntry["flower"], lesson: r.lesson, group: r.group_name, at: new Date(r.at).toISOString() }));
  return (
    <div className="mx-auto w-full flex max-w-3xl flex-col gap-8 px-4 py-8">
      <MascotSays mood="happy" size={72}>
        <p className="font-display text-xl font-semibold">Hi {user.displayName.split(" ")[0]}!</p>
        <p className="text-ink-muted">Ready to join a lesson? Type the code from the board.</p>
      </MascotSays>
      <Card className="p-6">
        <JoinForm />
      </Card>
      {sessions.length ? (
        <section aria-labelledby="my-lessons">
          <div className="mb-3 flex items-baseline justify-between gap-2"><h2 id="my-lessons" className="font-display text-lg font-semibold">My lessons</h2><Link href="/student/past" className="text-sm font-semibold text-teal hover:underline">All past lessons</Link></div>
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={s.status === "ended" && s.reflected ? `/student/past/${s.id}` : `/student/session/${s.id}`} className="group block rounded-2xl">
                  <Card className="flex items-center gap-3 p-4 transition-shadow group-hover:shadow-lift">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{s.title}</p>
                      <p className="text-sm text-ink-muted">{s.class_name}</p>
                    </div>
                    {s.status === "ended" ? (s.reflected ? <Badge>Finished</Badge> : <Badge tone="purple">Reflection waiting</Badge>) : <Badge tone="teal">{s.status === "lobby" ? "Waiting to start" : s.status === "paused" ? "Paused" : "Happening now"}</Badge>}
                    <ArrowRight className="size-4 text-ink-muted" aria-hidden="true" />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Garden entries={garden} />
      <div className="flex flex-wrap gap-2">
      <Button asChild variant="secondary" className="self-start"><Link href="/student/past"><BookOpen />Past lessons</Link></Button>
      <Button asChild variant="ghost" className="self-start"><Link href="/student/welcome?edit=1"><Settings2 />My working preferences</Link></Button>
      </div>
    </div>
  );
}
