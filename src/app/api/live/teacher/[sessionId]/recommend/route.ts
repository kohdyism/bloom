import { z } from "zod";
import { route, uuid } from "@/lib/api";
import { recommendForSession } from "@/lib/modules/sessions/teacher";

export const POST = route<z.ZodObject<{ seed: z.ZodNumber }>, { sessionId: string }>(
  { role: "teacher", body: z.object({ seed: z.number().int().min(1).max(1_000_000) }) },
  async ({ user, params, body }) => {
    const r = await recommendForSession(user.id, uuid.parse(params.sessionId), body.seed);
    return { ...r, score: Number.isFinite(r.score) ? r.score : null };
  },
);
