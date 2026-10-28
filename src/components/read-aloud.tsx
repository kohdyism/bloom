"use client";

import * as React from "react";
import { Square, Volume2 } from "lucide-react";
import { useA11y } from "@/components/a11y-provider";
import { cn } from "@/lib/utils";

/**
 * Read aloud: the device's own speech voice reads text to the student. It
 * runs entirely in the browser (nothing is sent anywhere) and only one thing
 * is read at a time.
 */
type State = { id: string | null };
let state: State = { id: null };
const listeners = new Set<() => void>();
const set = (s: State) => { state = s; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "en-GB" && v.localService) ?? voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
}

/** Strip things that sound odd read out (emoji, markdown symbols). */
const tidy = (t: string) => t.replace(/[*_#>`]/g, " ").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();

export function speak(text: string, opts: { id?: string; rate?: "slow" | "normal" } = {}) {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(tidy(text).slice(0, 4000));
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-GB";
  u.rate = opts.rate === "slow" ? 0.8 : 1;
  const id = opts.id ?? Math.random().toString(36).slice(2);
  u.onend = u.onerror = () => { if (state.id === id) set({ id: null }); };
  set({ id });
  synth.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
  set({ id: null });
}

/** A small speaker button that reads `text` aloud (or stops it). Hidden when the student turned read-aloud off. */
export function ReadAloudButton({ text, label = "Read aloud", className, size = "sm" }: { text: string; label?: string; className?: string; size?: "sm" | "md" }) {
  const { prefs } = useA11y();
  const id = React.useId();
  const current = React.useSyncExternalStore(subscribe, () => state.id, () => null);
  const [supported, setSupported] = React.useState(false);
  // Speech support is only known in the browser.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setSupported(canSpeak()), []);
  if (!supported || !prefs.readAloud || !text.trim()) return null;
  const playing = current === id;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (playing) stopSpeaking(); else speak(text, { id, rate: prefs.speechRate }); }}
      aria-label={playing ? "Stop reading" : label}
      aria-pressed={playing}
      title={playing ? "Stop reading" : label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-teal-strong hover:bg-teal-soft focus-visible:bg-teal-soft print:hidden",
        size === "md" ? "size-10 [&_svg]:size-5" : "size-8 [&_svg]:size-4",
        playing && "bg-teal text-white hover:bg-teal-strong",
        className,
      )}
    >
      {playing ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
    </button>
  );
}
