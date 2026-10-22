import { z } from "zod";
import { route } from "@/lib/api";
import { joinWithCode } from "@/lib/modules/sessions/student";

/** Join requires a signed-in, enrolled student: the code alone grants nothing. */
export const POST = route({ role: "student", body: z.object({ code: z.string().max(20) }) }, async ({ user, body }) => {
  const sessionId = await joinWithCode(user.id, body.code);
  return { sessionId };
});
