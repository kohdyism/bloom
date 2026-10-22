"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import {
  addConstraint, classInput, createClass, enrolInput, enrolStudent, removeConstraint, removeStudent, saveAccommodations,
} from "@/lib/modules/classes";
import { ACCOMMODATION_KINDS, type AccommodationKind } from "@/lib/domain/students";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; message?: string };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  return Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
}

export async function createClassAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("teacher");
  const parsed = classInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const { id } = await createClass(user.id, parsed.data);
  redirect(`/teacher/classes/${id}`);
}

export async function enrolStudentAction(classId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("teacher");
  const parsed = enrolInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  try {
    await enrolStudent(user.id, classId, parsed.data);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return { fieldErrors: { username: "That username is already taken." } };
    throw err;
  }
  revalidatePath(`/teacher/classes/${classId}`);
  return { ok: true, message: `${parsed.data.displayName} has been enrolled. Share their username and password with them privately.` };
}

export async function removeStudentAction(classId: string, studentId: string) {
  const user = await requireUser("teacher");
  await removeStudent(user.id, classId, studentId);
  revalidatePath(`/teacher/classes/${classId}`);
}

export async function addConstraintAction(classId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("teacher");
  const kind = form.get("kind") === "keep_together" ? "keep_together" : "keep_apart";
  const studentA = String(form.get("studentA") ?? "");
  const studentB = String(form.get("studentB") ?? "");
  if (!studentA || !studentB) return { error: "Choose two students." };
  if (studentA === studentB) return { error: "Choose two different students." };
  await addConstraint(user.id, classId, { kind, studentA, studentB });
  revalidatePath(`/teacher/classes/${classId}`);
  return { ok: true };
}

export async function removeConstraintAction(classId: string, constraintId: string) {
  const user = await requireUser("teacher");
  await removeConstraint(user.id, constraintId);
  revalidatePath(`/teacher/classes/${classId}`);
}

export async function saveAccommodationsAction(studentId: string, _: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("teacher");
  const kinds = form.getAll("accommodations").map(String).filter((k): k is AccommodationKind => (ACCOMMODATION_KINDS as string[]).includes(k));
  await saveAccommodations(user.id, studentId, kinds, String(form.get("note") ?? ""));
  revalidatePath(`/teacher/students/${studentId}`);
  return { ok: true, message: "Saved." };
}
