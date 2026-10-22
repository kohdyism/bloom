import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function minutesLabel(seconds: number) {
  const m = Math.round(seconds / 60);
  return m === 1 ? "1 min" : `${m} min`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export const AVATAR_COLORS: Record<string, { bg: string; fg: string }> = {
  teal: { bg: "var(--teal-soft)", fg: "var(--teal-strong)" },
  blue: { bg: "var(--blue-soft)", fg: "var(--blue-strong)" },
  purple: { bg: "var(--purple-soft)", fg: "var(--purple-strong)" },
  mint: { bg: "var(--mint-soft)", fg: "var(--mint-strong)" },
  coral: { bg: "var(--coral-soft)", fg: "var(--coral-strong)" },
  amber: { bg: "var(--amber-soft)", fg: "var(--amber)" },
};
