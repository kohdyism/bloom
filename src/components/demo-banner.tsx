import { FlaskConical } from "lucide-react";

/** Prominent, always-visible demo indicator (spec §29). */
export function DemoBanner({ aiMode }: { aiMode: "live" | "simulated" }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-purple px-4 py-1.5 text-center text-xs font-semibold text-white" role="note">
      <span className="inline-flex items-center gap-1.5">
        <FlaskConical className="size-3.5" aria-hidden="true" />
        Demo mode — every student, class and support need is fictional.
      </span>
      <span className="rounded-full bg-black/25 px-2 py-0.5" data-testid="ai-mode">
        {aiMode === "live" ? "AI: live (Claude API)" : "AI: simulated — no external AI calls"}
      </span>
    </div>
  );
}
