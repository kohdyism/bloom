import { route, uuid } from "@/lib/api";
import { privateConversation } from "@/lib/modules/private-ai";

export const dynamic = "force-dynamic";

/** The caller's own private conversation. There is deliberately no way to request someone else's. */
export const GET = route<undefined, { sessionId: string }>({ role: "student" }, async ({ user, params }) => {
  return { messages: await privateConversation(user.id, uuid.parse(params.sessionId)) };
});
