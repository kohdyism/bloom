"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { asUser } from "@/lib/db";
import { SURVEY_QUESTIONS, type Survey } from "@/lib/domain/students";

/** Save the student's own working-preferences survey (all questions optional). */
export async function saveSurveyAction(answers: Survey, next: string) {
  const user = await requireUser("student");
  const clean: Survey = {};
  for (const q of SURVEY_QUESTIONS) {
    const v = answers[q.key];
    if (v && q.options.some((o) => o.value === v)) clean[q.key] = v;
  }
  await asUser(user.id, async (db) => {
    await db.query(
      `insert into student_preferences(student_id, survey) values ($1, $2)
       on conflict (student_id) do update set survey = excluded.survey, updated_at = now()`,
      [user.id, JSON.stringify(clean)],
    );
    await db.query("update profiles set onboarded_at = coalesce(onboarded_at, now()) where id = $1", [user.id]);
  });
  revalidatePath("/student");
  redirect(next.startsWith("/student") ? next : "/student");
}
