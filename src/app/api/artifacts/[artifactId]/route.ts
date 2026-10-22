import { z } from "zod";
import { route, uuid } from "@/lib/api";
import { applyArtifactUpdate, getArtifactState } from "@/lib/modules/artifacts";

export const dynamic = "force-dynamic";

export const GET = route<undefined, { artifactId: string }>({}, async ({ user, params }) => {
  return getArtifactState(user.id, uuid.parse(params.artifactId));
});

const body = z.object({ update: z.string().min(1).max(800_000), clientUpdateId: z.string().min(8).max(80) });

export const POST = route<typeof body, { artifactId: string }>({ role: "student", body }, async ({ user, params, body: b }) => {
  return applyArtifactUpdate(user.id, uuid.parse(params.artifactId), b.update, b.clientUpdateId);
});
