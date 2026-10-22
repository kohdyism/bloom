"use client";

import { Mic, MicOff } from "lucide-react";
import { useA11y } from "@/components/a11y-provider";
import { useSpeechInput } from "./use-speech";
import { cn } from "@/lib/utils";

/** Push-to-talk dictation button; hidden when unsupported or turned off in settings. */
export function SpeechButton({ onText, className }: { onText: (t: string) => void; className?: string }) {
  const { prefs } = useA11y();
  const { supported, listening, error, toggle } = useSpeechInput(onText);
  if (!prefs.speechInput || !supported) return null;
  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        className={cn("inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium", listening ? "bg-coral-soft text-coral" : "text-ink-muted hover:bg-surface-2")}
      >
        {listening ? <MicOff className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
        {listening ? "Stop listening" : "Speak"}
      </button>
      {listening ? <span className="text-xs text-coral" role="status">Listening… press stop when you&apos;re done.</span> : null}
      {error ? <span className="text-xs text-coral" role="alert">{error}</span> : null}
    </span>
  );
}
