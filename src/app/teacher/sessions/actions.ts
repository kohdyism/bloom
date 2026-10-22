"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { launchSession } from "@/lib/modules/sessions/teacher";
import { ApiError } from "@/lib/api";

export async function launchSessionAction(lessonId: string): Promise<{ error?: string } | void> {
  const user = await requireUser("teacher");
  let id: string;
  try {
    id = await launchSession(user.id, lessonId);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  redirect(`/teacher/sessions/${id}`);
}
