import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { uuid } from "@/lib/api";
import { submissionForExport } from "@/lib/modules/sessions/state";
import type { SubmissionContent } from "@/components/live/submission-view";
import { PrintWork } from "./print-work";

export const metadata = { title: "Save as PDF" };

/** Print-ready copy of a group's submitted work: save as PDF from the browser. */
export default async function PrintPage(props: { params: Promise<{ submissionId: string }>; searchParams: Promise<{ part?: string }> }) {
  const user = await requireUser();
  const id = uuid.safeParse((await props.params).submissionId);
  if (!id.success) notFound();
  const work = await submissionForExport(user.id, id.data).catch(() => null);
  if (!work) notFound();
  const { part } = await props.searchParams;
  return <PrintWork work={{ ...work, content: work.content as SubmissionContent }} part={part} back={user.role === "teacher" ? "/teacher/reports" : "/student/past"} />;
}
