import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  redirect(user.role === "teacher" ? "/teacher" : user.onboarded ? "/student" : "/student/welcome");
}
