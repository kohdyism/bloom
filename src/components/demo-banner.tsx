import { FlaskConical } from "lucide-react";

/** Prominent, always-visible demo indicator (spec §29). */
export function DemoBanner({ aiMode }: { aiMode: "live" | "simulated" }) {
  return (
    <div className="flex items-center justify-center gap-x-3 bg-purple px-3 py-1 text-center text-[0.7rem] font-semibold text-white sm:flex-wrap sm:px-4 sm:py-1.5 sm:text-xs" role="note">
      <span className="inline-flex items-center gap-1.5">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="sm:hidden">Demo — all data is fictional</span>
        <span className="max-sm:hidden">Demo mode — every student, class and support need is fictional.</span>
      </span>
      <span className="whitespace-nowrap rounded-full bg-black/25 px-2 py-0.5" data-testid="ai-mode">
        <span className="sm:hidden">{aiMode === "live" ? "AI: live" : "AI: simulated"}</span>
        <span className="max-sm:hidden">{aiMode === "live" ? "AI: live (Claude API)" : "AI: simulated — no external AI calls"}</span>
      </span>
    </div>
  );
}
