"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Flower2, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/student", label: "Join a lesson", short: "Join", icon: LogIn, match: (p: string) => p === "/student" },
  { href: "/student/garden", label: "My garden", short: "Garden", icon: Flower2, match: (p: string) => p.startsWith("/student/garden") },
  { href: "/student/past", label: "Past lessons", short: "Past", icon: BookOpen, match: (p: string) => p.startsWith("/student/past") },
];

/** The student's three places: join a lesson, their garden, and lessons to look back on. */
export function StudentTabs() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Student" className="flex items-center gap-0.5 sm:ml-2 sm:gap-1">
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cn("inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold sm:px-3", active ? "bg-purple-soft text-purple" : "text-ink-muted hover:bg-surface-2 hover:text-ink")}>
            <t.icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="max-sm:hidden">{t.label}</span><span className="sm:hidden">{t.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
