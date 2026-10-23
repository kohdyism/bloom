import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { lessonReport } from "@/lib/modules/reports";
import { NotFoundError } from "@/lib/db";
import { REFLECTION_RATINGS } from "@/lib/domain/reflection";
import { ASSIST_LABELS } from "@/lib/domain/help";
import { Badge, Card, CardBody, CardHeader, CardTitle, Notice, PageHeader } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { AiOriginBadge } from "@/components/live/ai-badge";
import { IndividualReflections } from "./individual-reflections";
import { RegenerateButton } from "./regenerate-button";
import { SummaryPending } from "./summary-pending";

export const metadata = { title: "Lesson report" };

export default async function ReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser("teacher");
  const { sessionId } = await params;
  const r = await lessonReport(user.id, sessionId).catch((e) => {
    if (e instanceof NotFoundError || (e as { code?: string }).code === "22P02") notFound();
    throw e;
  });
  return (
    <div className="flex flex-col gap-6">
      <Link href="/teacher/reports" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" />All reports</Link>
      <PageHeader
        eyebrow="Lesson report"
        title={r.title}
        description={`${r.endedAt ? new Date(r.endedAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" }) : "Still running"} · about ${r.durationMinutes} min`}
        actions={<Button asChild variant="secondary"><a href={`/api/reports/${sessionId}?format=csv`}><Download />Export CSV</a></Button>}
      />
      {r.status !== "ended" ? <Notice tone="amber">This lesson hasn&apos;t ended yet, so the report is incomplete and has no AI summary.</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Attendance" value={`${r.attendance} / ${r.enrolled}`} />
        <Stat label="Groups" value={String(r.groups.length)} />
        <Stat label="Groups completing every stage" value={`${r.groups.filter((g) => g.stagesCompleted >= g.totalStages).length} / ${r.groups.length}`} />
        <Stat label="Reflections" value={`${r.reflection.responses}`} />
      </div>

      {r.summary ? (
        <Card className="border-purple/30">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex flex-wrap items-center gap-2">Summary <AiOriginBadge origin={r.summaryOrigin} /></CardTitle>
            <RegenerateButton sessionId={sessionId} />
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <p>{r.summary.overview}</p>
            {r.summary.suggestions.length ? (
              <div>
                <p className="text-sm font-semibold">Suggestions for next time <span className="font-normal text-ink-muted">(AI suggestions — use your judgement)</span></p>
                <ul className="mt-1 list-disc pl-5 text-sm">{r.summary.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            ) : r.status === "ended" ? <SummaryPending sessionId={sessionId} /> : null}
            <p className="text-xs text-ink-muted">Generated only from recorded lesson events, counts and students&apos; own reflection words. It doesn&apos;t include discussion that happened out loud in the room.</p>
          </CardBody>
        </Card>
      ) : null}

      <section aria-labelledby="groups-h">
        <h2 id="groups-h" className="mb-3 font-display text-lg font-semibold">Groups</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {r.groups.map((g) => {
            const sum = r.summary?.groupSummaries.find((s) => s.groupRef === g.ref);
            const help = Object.values(g.helpRequests).reduce((a, b) => a + b, 0);
            return (
              <Card key={g.id}>
                <CardHeader>
                  <CardTitle>{g.name}</CardTitle>
                  <p className="text-sm text-ink-muted">{g.members.join(", ")}</p>
                </CardHeader>
                <CardBody className="flex flex-col gap-3 text-sm">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <dt className="text-ink-muted">Stages completed</dt><dd className="font-semibold">{g.stagesCompleted} of {g.totalStages}</dd>
                    <dt className="text-ink-muted">Extra time given</dt><dd className="font-semibold">{Math.round(g.extensionsSeconds / 60)} min</dd>
                    <dt className="text-ink-muted">Help requests</dt><dd className="font-semibold">{help}</dd>
                    <dt className="text-ink-muted">Ideas shared</dt><dd className="font-semibold">{g.ideasShared}</dd>
                    <dt className="text-ink-muted">Written messages</dt><dd className="font-semibold">{g.messages}</dd>
                  </dl>
                  {g.roles.length ? <p><span className="text-ink-muted">Roles:</span> {g.roles.map((x) => `${x.name} (${x.role})`).join(", ")}</p> : null}
                  <div className="flex flex-wrap gap-1.5">{g.submissions.length ? g.submissions.map((s) => <Badge key={s.id} tone={s.status === "reviewed" ? "mint" : s.status === "returned" ? "amber" : "blue"}>v{s.version} · {s.status}</Badge>) : <Badge>No submission</Badge>}</div>
                  {sum ? <p className="rounded-xl bg-purple-soft/40 p-3"><AiOriginBadge origin={r.summaryOrigin} className="mr-1.5" />{sum.summary}</p> : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Student reflections</CardTitle>
          <p className="text-sm text-ink-muted">Aggregated across {r.reflection.responses} response{r.reflection.responses === 1 ? "" : "s"}. Ratings are 1 (low) to 5 (high).</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-6">
          {r.reflection.responses === 0 ? <p className="text-sm text-ink-muted">No reflections yet.</p> : (
            <ul className="flex flex-col gap-4">
              {REFLECTION_RATINGS.map((q) => {
                const dist = r.reflection.distributions[q.key] ?? [0, 0, 0, 0, 0];
                const total = dist.reduce((a, b) => a + b, 0);
                const avg = r.reflection.averages[q.key];
                return (
                  <li key={q.key} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_16rem] md:items-center">
                    <div>
                      <p className="font-medium">{q.question}</p>
                      <p className="text-sm text-ink-muted">{avg !== null && avg !== undefined ? `Average ${avg}` : "No answers"} · {total} answer{total === 1 ? "" : "s"}</p>
                    </div>
                    <div className="flex h-10 items-end gap-1" role="img" aria-label={`Answers: ${dist.map((n, i) => `${i + 1}: ${n}`).join(", ")}`}>
                      {dist.map((n, i) => (
                        <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                          <div className="w-full rounded-t bg-teal" style={{ height: `${total ? Math.max(4, (n / Math.max(...dist)) * 32) : 4}px`, opacity: 0.35 + i * 0.16 }} />
                          <span className="text-[0.65rem] text-ink-muted">{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {r.reflection.themes.length ? (
            <div>
              <p className="font-semibold">Themes in what students wrote</p>
              <ul className="mt-2 flex flex-wrap gap-2">{r.reflection.themes.map((t) => <li key={t.theme}><Badge tone="teal">{t.theme} · {t.mentions}</Badge></li>)}</ul>
              <p className="mt-1 text-xs text-ink-muted">Counted from keywords in students&apos; own answers.</p>
            </div>
          ) : null}
          <IndividualReflections sessionId={sessionId} respondents={r.reflection.respondents} />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Help requests</CardTitle></CardHeader>
          <CardBody>{r.help.length ? <ul className="flex flex-col gap-1 text-sm">{r.help.map((h) => <li key={h.reason} className="flex justify-between"><span>{h.label}</span><strong>{h.count}</strong></li>)}</ul> : <p className="text-sm text-ink-muted">None.</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Private assistant use</CardTitle><p className="text-sm text-ink-muted">Counts by type only — conversations stay private to students.</p></CardHeader>
          <CardBody>{r.aiUsage.length ? <ul className="flex flex-col gap-1 text-sm">{r.aiUsage.map((a) => <li key={a.action} className="flex justify-between"><span>{ASSIST_LABELS[a.action] ?? a.action}</span><strong>{a.count}</strong></li>)}</ul> : <p className="text-sm text-ink-muted">Not used.</p>}</CardBody>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="font-display text-3xl font-bold">{value}</p>
    </Card>
  );
}
