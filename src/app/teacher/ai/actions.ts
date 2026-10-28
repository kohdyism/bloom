"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { aiSettingsSchema, saveAiSettings, type AiSettings } from "@/lib/modules/ai-settings";

export async function saveAiSettingsAction(input: AiSettings): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser("teacher");
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the settings and try again." };
  await saveAiSettings(user.id, parsed.data);
  revalidatePath("/teacher/ai");
  return { ok: true };
}
