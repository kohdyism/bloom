import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { Mascot } from "@/components/mascot";
import { Avatar } from "@/components/ui/primitives";
import { AccessibilitySettingsButton } from "@/components/accessibility-settings";
import { signOutAction } from "@/app/(auth)/sign-in/actions";
import { StudentNav } from "./student-nav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("student");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StudentNav>
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto w-full flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href="/student" className="flex items-center gap-2 rounded-lg">
            <Mascot size={30} animate={false} />
            <span className="font-display text-lg font-bold">Canopy</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden items-center gap-2 pr-2 text-sm font-medium sm:flex"><Avatar name={user.displayName} color={user.avatarColor} size="sm" />{user.displayName}</span>
            <AccessibilitySettingsButton showStudentOptions compact />
            <form action={signOutAction}>
              <button type="submit" className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-surface-2" aria-label="Sign out"><LogOut className="size-4" aria-hidden="true" /></button>
            </form>
          </div>
        </div>
      </header>
      </StudentNav>
      <main id="main" className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
