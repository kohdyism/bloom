import { requireUser } from "@/lib/auth/current-user";
import { TeacherNav } from "./teacher-nav";
import { Mascot } from "@/components/mascot";
import { Avatar } from "@/components/ui/primitives";
import { AccessibilitySettingsButton } from "@/components/accessibility-settings";
import { signOutAction } from "@/app/(auth)/sign-in/actions";
import { LogOut } from "lucide-react";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("teacher");
  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col lg:flex-row">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-5 py-4 lg:py-5">
          <a href="/teacher" className="flex items-center gap-2 rounded-lg">
            <Mascot size={36} animate={false} />
            <span className="font-display text-xl font-bold">Canopy</span>
          </a>
          <div className="flex items-center gap-1">
            <span className="rounded-full bg-teal-soft px-2 py-0.5 text-xs font-semibold text-teal-strong">Teacher</span>
            <div className="flex lg:hidden">
              <AccessibilitySettingsButton compact />
              <form action={signOutAction}>
                <button className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-surface-2" type="submit" aria-label="Sign out">
                  <LogOut className="size-4" aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        </div>
        <TeacherNav />
        <div className="hidden border-t border-line px-4 py-4 lg:absolute lg:bottom-0 lg:block lg:w-full">
          <div className="flex items-center gap-3">
            <Avatar name={user.displayName} color={user.avatarColor} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.displayName}</p>
              <p className="truncate text-xs text-ink-muted">@{user.username}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            <AccessibilitySettingsButton />
            <form action={signOutAction}>
              <button className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-surface-2" type="submit">
                <LogOut className="size-4" aria-hidden="true" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:py-8">{children}</main>
    </div>
  );
}
