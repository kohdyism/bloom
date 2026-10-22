import { requireUser } from "@/lib/auth/current-user";
import { asUser } from "@/lib/db";
import type { Survey } from "@/lib/domain/students";
import { SurveyForm } from "./survey-form";

export const metadata = { title: "How you like to work" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser("student");
  const { edit } = await searchParams;
  const row = await asUser(user.id, (db) => db.maybeOne<{ survey: Survey }>("select survey from student_preferences where student_id = $1", [user.id]));
  const supports = await asUser(user.id, (db) => db.query<{ kind: string }>("select kind from student_accommodations where student_id = $1", [user.id]));
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <SurveyForm name={user.displayName.split(" ")[0]} initial={row?.survey ?? {}} editing={!!edit || user.onboarded} supports={supports.map((s) => s.kind)} />
    </div>
  );
}
