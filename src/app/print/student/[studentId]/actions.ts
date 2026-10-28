"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { uuid } from "@/lib/api";
import { confirmContributionReview, suggestContributionReview } from "@/lib/modules/student-report";

export async function suggestReviewAction(sessionId: string, studentId: string): Promise<{ error?: string }> {
  const user = await requireUser("teacher");
  if (!uuid.safeParse(sessionId).success || !uuid.safeParse(studentId).success) return { error: "Not found." };
  try { await suggestContributionReview(user.id, sessionId, studentId); } catch { return { error: "Couldn't make a suggestion just now. Please try again." }; }
  revalidatePath(`/print/student/${studentId}`);
  return {};
}

export async function confirmReviewAction(sessionId: string, studentId: string, levels: Record<string, number | null>, note: string): Promise<{ error?: string }> {
  const user = await requireUser("teacher");
  if (!uuid.safeParse(sessionId).success || !uuid.safeParse(studentId).success) return { error: "Not found." };
  try { await confirmContributionReview(user.id, sessionId, studentId, levels, note); } catch { return { error: "Couldn't save just now. Please try again." }; }
  revalidatePath(`/print/student/${studentId}`);
  return {};
}
