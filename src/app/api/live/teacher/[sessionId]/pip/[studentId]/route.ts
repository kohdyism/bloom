import { route, uuid } from "@/lib/api";
import { teacherPipConversation } from "@/lib/modules/private-ai";

export const dynamic = "force-dynamic";

export const GET = route<undefined, { sessionId: string; studentId: string }>({ role: "teacher" }, async ({ user, params }) => {
  return { messages: await teacherPipConversation(user.id, uuid.parse(params.sessionId), uuid.parse(params.studentId)) };
});
