import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { JoinForm } from "@/app/student/join-form";
import { Card } from "@/components/ui/primitives";
import { MascotSays } from "@/components/mascot";

export const metadata = { title: "Join a lesson" };

/** QR target. Signing in is always required first; the code alone grants nothing. */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams;
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/join?code=${clean}`)}`);
  if (user.role !== "student") redirect("/teacher");
  if (!user.onboarded) redirect("/student/welcome");
  return (
    <main id="main" className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <MascotSays mood="wave">Joining your lesson…</MascotSays>
      <Card className="p-6"><JoinForm initialCode={clean} autoSubmit={!!clean} /></Card>
    </main>
  );
}
