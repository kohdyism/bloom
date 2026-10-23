import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Settings2 } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { asUser } from "@/lib/db";
import { FLOWERS } from "@/lib/domain/flowers";
import { myGarden } from "@/lib/modules/garden";
import { FlowerPicture } from "@/components/flower";
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
  const garden = await myGarden(user.id);
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
      <Link href="/student/garden" className="group block rounded-[2rem]">
        <Card className="flex items-center gap-4 bg-gradient-to-r from-[#f2fbf3] to-[#fff7ee] p-4 transition-shadow group-hover:shadow-lift">
          <span className="flex -space-x-3" aria-hidden="true">
            {(garden.length ? [...new Set(garden.map((g) => g.flower))].slice(-3) : ["daisy" as const]).map((f) => <span key={f} className="flex size-12 items-center justify-center rounded-full border-2 border-white bg-white"><FlowerPicture id={f} size={34} faded={!garden.length} /></span>)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">My garden</p>
            <p className="text-sm text-ink-muted">{new Set(garden.map((g) => g.flower)).size} of {FLOWERS.length} flowers found</p>
          </div>
          <ArrowRight className="size-4 text-ink-muted" aria-hidden="true" />
        </Card>
      </Link>
      <div className="flex flex-wrap gap-2">
      <Button asChild variant="ghost" className="self-start"><Link href="/student/welcome?edit=1"><Settings2 />My working preferences</Link></Button>
      </div>
    </div>
  );
}
