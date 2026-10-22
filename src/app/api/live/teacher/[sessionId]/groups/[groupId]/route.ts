import { route, uuid } from "@/lib/api";
import { teacherGroupDetail } from "@/lib/modules/sessions/state";

export const dynamic = "force-dynamic";

export const GET = route<undefined, { sessionId: string; groupId: string }>({ role: "teacher" }, async ({ user, params }) => {
  return teacherGroupDetail(user.id, uuid.parse(params.sessionId), uuid.parse(params.groupId));
});
