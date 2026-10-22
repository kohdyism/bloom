import { route } from "@/lib/api";
import { asUser } from "@/lib/db";
import { accessibilitySchema } from "@/lib/domain/accessibility";

export const PUT = route({ role: "student", body: accessibilitySchema }, async ({ user, body }) => {
  await asUser(user.id, (db) =>
    db.query(
      `insert into student_preferences(student_id, accessibility) values ($1, $2)
       on conflict (student_id) do update set accessibility = excluded.accessibility, updated_at = now()`,
      [user.id, JSON.stringify(body)],
    ),
  );
  return { ok: true };
});
