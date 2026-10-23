import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Every AI-produced item carries a visible label (spec §26 "clear AI-use
 * indicators"). Simulated or fallback output is labelled as such.
 */
export function AiOriginBadge({ origin, edited, className }: { origin: string | null | undefined; edited?: boolean; className?: string }) {
  const label =
    origin === "ai" ? "AI-generated" :
    origin === "ai_simulated" ? "Simulated AI" :
    origin === "offline_helper" ? "Backup reply (AI didn't respond)" :
    origin === "facilitator_nudge" ? "Pip · just for you" : "AI";
  const title =
    origin === "ai" ? "Written by Claude (AI). It can make mistakes — check it and challenge it." :
    origin === "ai_simulated" ? "Demo mode: produced by Canopy's built-in rules, not a live AI model." :
    origin === "offline_helper" ? "The AI service didn't respond, so Canopy's built-in helper produced this instead." : undefined;
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-full bg-purple-soft px-2 py-0.5 align-middle text-[0.7rem] font-semibold text-purple", className)}>
      <Sparkles className="size-3" aria-hidden="true" />
      {label}{edited ? " · edited by students" : ""}
    </span>
  );
}
