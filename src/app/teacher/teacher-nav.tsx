"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, Radio, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/teacher", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/teacher/classes", label: "Classes & students", icon: Users },
  { href: "/teacher/lessons", label: "Lesson library", icon: BookOpen },
  { href: "/teacher/sessions", label: "Live sessions", icon: Radio },
  { href: "/teacher/reports", label: "Reports", icon: BarChart3 },
];

export function TeacherNav() {
  const path = usePathname();
  return (
    <nav aria-label="Teacher" className="overflow-x-auto px-3 pb-3 lg:pb-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-[0.95rem] font-medium",
                  active ? "bg-teal-soft text-teal-strong" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon className="size-[1.15rem]" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
