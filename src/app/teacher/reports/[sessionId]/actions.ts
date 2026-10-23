"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { lessonReport } from "@/lib/modules/reports";
import { rateLimit } from "@/lib/security/rate-limit";

export async function regenerateReportAction(sessionId: string) {
  const user = await requireUser("teacher");
  await rateLimit(`report:${user.id}`, 10, 3600);
  await lessonReport(user.id, sessionId, { regenerate: true });
  revalidatePath(`/teacher/reports/${sessionId}`);
}

/** Write the summary if it isn't there yet (opening a report never waits for the AI). */
export async function generateReportAction(sessionId: string) {
  const user = await requireUser("teacher");
  await lessonReport(user.id, sessionId, { generate: true });
  revalidatePath(`/teacher/reports/${sessionId}`);
}
