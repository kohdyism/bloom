"use client";

import { usePathname } from "next/navigation";

/** The generic student header steps aside inside a live lesson, which has its own full-screen header. */
export function StudentNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/student/session/")) return null;
  return <>{children}</>;
}
