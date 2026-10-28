import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { uuid } from "@/lib/api";
import { studentProgress } from "@/lib/modules/student-report";
import { helpLabel } from "@/lib/domain/help";
import { PrintBar } from "./print-bar";

export const metadata = { title: "Student progress report" };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** One student's progress across lessons, laid out for paper: print or save as PDF for parent–teacher meetings. */
export default async function StudentReportPage(props: { params: Promise<{ studentId: string }> }) {
  const user = await requireUser("teacher");
  const id = uuid.safeParse((await props.params).studentId);
  if (!id.success) notFound();
  const r = await studentProgress(user.id, id.data).catch(() => null);
  if (!r) notFound();
  const done = r.lessons.filter((l) => l.ended);
  const total = (k: "ideas" | "messages" | "votes" | "edits") => r.lessons.reduce((a, l) => a + l[k], 0);
  const helpCount = r.lessons.reduce((a, l) => a + l.help.length, 0);
  const reflected = r.lessons.filter((l) => l.reflection);
  // Average of each lesson's own 1–5 answers, for the summary line.
  const allRatings = reflected.flatMap((l) => l.reflection!.ratings.map((x) => x.value).filter((v): v is number => typeof v === "number" && v >= 1));
  const avg = allRatings.length ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10 : null;

  return (
    <div className="mx-auto w-full max-w-4xl bg-white px-6 py-6 text-ink print:max-w-none print:p-0">
      <style>{`@media print { @page { size: A4; margin: 14mm; } body { background: white !important; } [data-demo-banner] { display: none; } .lesson { break-inside: avoid; } }`}</style>
      <PrintBar back={`/teacher/students/${r.student.id}`} />
      <header className="mb-6 border-b border-line pb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">Canopy · Student progress report</p>
        <h1 className="font-display text-3xl font-bold">{r.student.name}</h1>
        <p className="text-ink-muted">{r.lessons.length} lesson{r.lessons.length === 1 ? "" : "s"}{r.lessons.length ? ` · ${day(r.lessons[0].date)} to ${day(r.lessons[r.lessons.length - 1].date)}` : ""} · Printed {day(r.generatedAt)}</p>
        <p className="mt-2 text-xs text-ink-muted">Confidential: for the student, their family and school staff. Fictional demo data.</p>
      </header>

      <section aria-labelledby="sum-h" className="mb-6">
        <h2 id="sum-h" className="mb-2 font-display text-xl font-semibold">Summary</h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Lessons", `${r.lessons.length}`],
            ["Ideas shared", `${total("ideas")}`],
            ["Chat messages", `${total("messages")}`],
            ["Votes cast", `${total("votes")}`],
            ["Edits to group work", `${total("edits")}`],
            ["Help requests", `${helpCount}`],
            ["Reflections", `${reflected.length} of ${done.length}`],
            ["Average self-rating", avg === null ? "—" : `${avg} / 5`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line px-3 py-2"><dt className="text-xs text-ink-muted">{k}</dt><dd className="font-display text-xl font-bold">{v}</dd></div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="les-h" className="flex flex-col gap-4">
        <h2 id="les-h" className="font-display text-xl font-semibold">Lesson by lesson</h2>
        {r.lessons.length === 0 ? <p className="text-ink-muted">No lessons yet.</p> : null}
        {r.lessons.map((l) => (
          <article key={l.sessionId} className="lesson rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-lg font-semibold">{l.title}</h3>
              <p className="text-sm text-ink-muted">{day(l.date)} · {l.className}{l.groupName ? ` · Group ${l.groupName}` : ""}</p>
            </div>
            <p className="mt-1 text-sm">
              Took part in {l.stagesDone} of {l.totalStages} stages · {l.ideas} idea{l.ideas === 1 ? "" : "s"} · {l.messages} message{l.messages === 1 ? "" : "s"} · {l.votes} vote{l.votes === 1 ? "" : "s"} · {l.edits} edit{l.edits === 1 ? "" : "s"} to the group&apos;s work
            </p>
            <p className="mt-1 text-sm">{l.help.length ? <>Asked for help {l.help.length} time{l.help.length === 1 ? "" : "s"}: {l.help.map(helpLabel).join("; ")}</> : "No help requests."}</p>
            {l.reflection ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm font-semibold">How they rated it (1–5)</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {l.reflection.ratings.map((x) => (
                      <li key={x.key} className="flex justify-between gap-3 border-b border-dotted border-line py-0.5"><span>{x.question}</span><strong className="shrink-0">{x.value ? `${x.value}` : "—"}</strong></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold">In their own words</p>
                  {l.reflection.answers.length ? (
                    <ul className="flex flex-col gap-2 text-sm">{l.reflection.answers.map((a) => <li key={a.key}><span className="text-ink-muted">{a.question}</span><br />“{a.text}”</li>)}</ul>
                  ) : <p className="text-sm text-ink-muted">No written answers.</p>}
                </div>
              </div>
            ) : <p className="mt-2 text-sm text-ink-muted">{l.ended ? "No reflection submitted." : "Lesson still running."}</p>}
          </article>
        ))}
      </section>
    </div>
  );
}
