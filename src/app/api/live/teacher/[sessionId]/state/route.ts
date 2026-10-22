import { route, uuid } from "@/lib/api";
import { teacherState } from "@/lib/modules/sessions/state";

export const dynamic = "force-dynamic";

export const GET = route<undefined, { sessionId: string }>({ role: "teacher" }, async ({ user, params }) => {
  return teacherState(user.id, uuid.parse(params.sessionId));
});
