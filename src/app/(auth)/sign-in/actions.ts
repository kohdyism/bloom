"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authBackend } from "@/lib/auth/backend";
import { asServer } from "@/lib/db";
import { rateLimit, RateLimitError } from "@/lib/security/rate-limit";

export type SignInState = { error?: string; username?: string; fieldErrors?: { username?: string; password?: string } };

export async function signInAction(_prev: SignInState, form: FormData): Promise<SignInState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  const fieldErrors: SignInState["fieldErrors"] = {};
  if (!username) fieldErrors.username = "Enter your username.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (fieldErrors.username || fieldErrors.password) return { fieldErrors, username };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  try {
    await rateLimit(`signin:${username}`, 10, 300);
    await rateLimit(`signin-ip:${ip}`, 60, 300);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: "Too many attempts. Please wait a few minutes, or ask your teacher.", username };
    throw err;
  }

  const uid = await authBackend().signIn(username, password);
  if (!uid) return { error: "That username and password don't match. Check with your teacher if you're stuck.", username };

  const profile = await asServer((db) =>
    db.one<{ role: string; onboarded_at: Date | null }>("select role, onboarded_at from profiles where id = $1", [uid]),
  );
  // Only follow same-site relative redirects.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : null;
  if (profile.role === "student" && !profile.onboarded_at) redirect("/student/welcome");
  redirect(safeNext ?? (profile.role === "teacher" ? "/teacher" : "/student"));
}

export async function signOutAction() {
  await authBackend().signOut();
  redirect("/sign-in");
}
