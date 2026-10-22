"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { lessonDraftSchema, defaultConfig, makeStage, type LessonDraft } from "@/lib/domain/lesson";
import { LESSON_TEMPLATES } from "@/lib/domain/templates";
import {
  addFileMaterial, addTextMaterial, approveAiDraft, createLesson, deleteLesson, duplicateLesson, removeMaterial, saveLesson,
} from "@/lib/modules/lessons";
import { generateLessonDraft } from "@/lib/ai/lesson-generation";
import { rateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { ALLOWED_MATERIAL_TYPES, MAX_UPLOAD_BYTES, putObject, sniffMime } from "@/lib/storage";

export async function createFromTemplateAction(templateKey: string, classId: string | null) {
  const user = await requireUser("teacher");
  const template = LESSON_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) throw new Error("Unknown template");
  const id = await createLesson(user.id, template.build(), { classId, source: "template" });
  redirect(`/teacher/lessons/${id}`);
}

export async function createBlankAction(classId: string | null) {
  const user = await requireUser("teacher");
  const draft: LessonDraft = {
    title: "Untitled lesson", description: "", subject: "", yearLevel: "", objectives: [],
    config: defaultConfig(), stages: [makeStage("orientation")],
  };
  const id = await createLesson(user.id, draft, { classId, source: "scratch" });
  redirect(`/teacher/lessons/${id}`);
}

export type GenerateState = { error?: string };

const generateInput = z.object({
  description: z.string().trim().min(15, "Describe the activity in a sentence or two.").max(2000),
  subject: z.string().trim().max(80).optional(),
  yearLevel: z.string().trim().max(40).optional(),
  minutes: z.coerce.number().int().min(5).max(120).optional().or(z.literal("").transform(() => undefined)),
  classId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
});

export async function generateLessonAction(_: GenerateState, form: FormData): Promise<GenerateState> {
  const user = await requireUser("teacher");
  const parsed = generateInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  try {
    await rateLimit(`ai-lesson:${user.id}`, 20, 3600);
  } catch (e) {
    if (e instanceof RateLimitError) return { error: e.message };
    throw e;
  }
  const { data, origin } = await generateLessonDraft(parsed.data);
  const draft = lessonDraftSchema.safeParse(data.draft);
  if (!draft.success) return { error: "The draft couldn't be built. Try describing the activity differently, or start from a template." };
  const id = await createLesson(user.id, draft.data, { classId: parsed.data.classId ?? null, source: "ai" });
  redirect(`/teacher/lessons/${id}?generated=${origin}&note=${encodeURIComponent(data.rationale.slice(0, 400))}`);
}

export type SaveState = { ok?: boolean; error?: string; savedAt?: string };

export async function saveLessonAction(lessonId: string, payload: { draft: LessonDraft; classId: string | null }): Promise<SaveState> {
  const user = await requireUser("teacher");
  const parsed = lessonDraftSchema.safeParse(payload.draft);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `Couldn't save: ${issue?.path.join(" › ")} — ${issue?.message}` };
  }
  try {
    await saveLesson(user.id, lessonId, parsed.data, payload.classId);
  } catch (e) {
    return { error: (e as Error).message || "Couldn't save the lesson." };
  }
  revalidatePath(`/teacher/lessons/${lessonId}`);
  revalidatePath("/teacher/lessons");
  return { ok: true, savedAt: new Date().toISOString() };
}

export async function approveDraftAction(lessonId: string) {
  const user = await requireUser("teacher");
  await approveAiDraft(user.id, lessonId);
  revalidatePath(`/teacher/lessons/${lessonId}`);
}

export async function duplicateLessonAction(lessonId: string, asTemplate: boolean) {
  const user = await requireUser("teacher");
  const id = await duplicateLesson(user.id, lessonId, asTemplate);
  redirect(`/teacher/lessons/${id}`);
}

export async function deleteLessonAction(lessonId: string) {
  const user = await requireUser("teacher");
  await deleteLesson(user.id, lessonId);
  redirect("/teacher/lessons");
}

export type MaterialState = { error?: string; ok?: boolean; title?: string; body?: string };

export async function addMaterialAction(lessonId: string, _: MaterialState, form: FormData): Promise<MaterialState> {
  const user = await requireUser("teacher");
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "");
  const file = form.get("file");
  const keep = { title, body };
  if (!title) return { error: "Give the material a title.", ...keep };
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) return { error: "That file is over 8 MB. Try a smaller version.", ...keep };
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = sniffMime(buf) ?? (file.type === "text/plain" ? "text/plain" : null);
    if (!mime || !ALLOWED_MATERIAL_TYPES.includes(mime)) return { error: "Upload a PDF, image or plain-text file.", ...keep };
    const key = await putObject(`materials/${lessonId}`, buf, mime);
    await addFileMaterial(user.id, lessonId, title, key, mime);
  } else if (body.trim()) {
    await addTextMaterial(user.id, lessonId, title, body);
  } else {
    return { error: "Paste some text or choose a file.", ...keep };
  }
  revalidatePath(`/teacher/lessons/${lessonId}`);
  return { ok: true };
}

export async function removeMaterialAction(lessonId: string, materialId: string) {
  const user = await requireUser("teacher");
  await removeMaterial(user.id, materialId);
  revalidatePath(`/teacher/lessons/${lessonId}`);
}
