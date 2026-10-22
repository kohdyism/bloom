import { route, uuid } from "@/lib/api";
import { individualReflection, lessonReport, reportToCsv } from "@/lib/modules/reports";

export const dynamic = "force-dynamic";

/**
 * GET ?format=csv           export
 * GET ?reflection=<id>      deliberate, audited drill-down into one response
 */
export const GET = route<undefined, { sessionId: string }>({ role: "teacher" }, async ({ user, params, req }) => {
  const sessionId = uuid.parse(params.sessionId);
  const url = new URL(req.url);
  const reflectionId = url.searchParams.get("reflection");
  if (reflectionId) return individualReflection(user.id, sessionId, uuid.parse(reflectionId));
  const report = await lessonReport(user.id, sessionId);
  if (url.searchParams.get("format") === "csv") {
    return new Response(reportToCsv(report), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bloom-report-${sessionId.slice(0, 8)}.csv"` },
    });
  }
  return report;
});
