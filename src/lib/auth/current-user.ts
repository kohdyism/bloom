import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { asUser } from "@/lib/db";
import { authBackend } from "./backend";

export type Role = "teacher" | "student";
export type CurrentUser = {
  id: string;
  role: Role;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarIcon: string;
  onboarded: boolean;
};

/** The signed-in user, read through RLS (a user can always read their own profile). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const uid = await authBackend().currentUserId();
  if (!uid) return null;
  const row = await asUser(uid, (db) =>
    db.maybeOne<{
      id: string; role: Role; display_name: string; username: string;
      avatar_color: string; avatar_icon: string; onboarded_at: Date | null;
    }>("select id, role, display_name, username, avatar_color, avatar_icon, onboarded_at from profiles where id = $1", [uid]),
  ).catch(() => null);
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    username: row.username,
    avatarColor: row.avatar_color,
    avatarIcon: row.avatar_icon,
    onboarded: row.onboarded_at !== null,
  };
});

/** For pages: redirect to sign-in (or the right home) when the role doesn't match. */
export async function requireUser(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (role && user.role !== role) redirect(user.role === "teacher" ? "/teacher" : "/student");
  return user;
}
