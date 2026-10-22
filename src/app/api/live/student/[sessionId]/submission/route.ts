import { route, uuid } from "@/lib/api";
import { studentOwnSubmission } from "@/lib/modules/sessions/state";

export const dynamic = "force-dynamic";

/** The caller's own group's latest submission (never another group's). */
export const GET = route<undefined, { sessionId: string }>({ role: "student" }, async ({ user, params }) => {
  return { submission: await studentOwnSubmission(user.id, uuid.parse(params.sessionId)) };
});
