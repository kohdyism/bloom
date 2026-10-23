"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { saveLookBackNote } from "@/lib/modules/past-lessons";
import { rateLimit } from "@/lib/security/rate-limit";

export async function saveNoteAction(sessionId: string, body: string) {
  const user = await requireUser("student");
  await rateLimit(`note:${user.id}`, 60, 3600);
  await saveLookBackNote(user.id, sessionId, body);
  revalidatePath(`/student/past/${sessionId}`);
}
