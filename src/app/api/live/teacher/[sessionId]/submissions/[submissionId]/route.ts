import { route, uuid } from "@/lib/api";
import { teacherSubmission } from "@/lib/modules/artifacts";

export const dynamic = "force-dynamic";

export const GET = route<undefined, { sessionId: string; submissionId: string }>({ role: "teacher" }, async ({ user, params }) => {
  const s = await teacherSubmission(user.id, uuid.parse(params.sessionId), uuid.parse(params.submissionId));
  return { id: s.id, version: s.version, status: s.status, content: s.content, feedback: s.feedback, note: s.note, createdAt: s.created_at.toISOString() };
});
