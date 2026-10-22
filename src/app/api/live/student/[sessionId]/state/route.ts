import { route, uuid } from "@/lib/api";
import { studentState } from "@/lib/modules/sessions/state";

export const dynamic = "force-dynamic";

export const GET = route<undefined, { sessionId: string }>({ role: "student" }, async ({ user, params }) => {
  return studentState(user.id, uuid.parse(params.sessionId));
});
