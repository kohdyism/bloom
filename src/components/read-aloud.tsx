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

/**
 * Prefer a voice that runs on the device: Chrome's online ("Google …")
 * voices can fail silently, or stop after about 15 seconds.
 */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const local = voices.filter((v) => v.localService);
  return local.find((v) => v.lang === "en-GB") ?? local.find((v) => v.lang.startsWith("en")) ?? voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
}

// Voices load asynchronously in Chrome: ask early so the list is ready.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  try { window.speechSynthesis.getVoices(); window.speechSynthesis.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices()); } catch { /* not supported */ }
}

/** Strip things that sound odd read out (emoji, markdown symbols). */
const tidy = (t: string) => t.replace(/[*_#>`]/g, " ").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();

/** Short pieces at sentence breaks: long single utterances get cut off in some browsers. */
export function chunkForSpeech(text: string, max = 180): string[] {
  const sentences = tidy(text).slice(0, 4000).match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [];
  const out: string[] = [];
  let cur = "";
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > max) {
      if (cur) { out.push(cur); cur = ""; }
      const words = s.split(" ");
      let part = "";
      for (const w of words) { if ((part + " " + w).trim().length > max) { out.push(part.trim()); part = w; } else part = `${part} ${w}`; }
      if (part.trim()) out.push(part.trim());
    } else if ((cur + " " + s).trim().length > max) { out.push(cur); cur = s; }
    else cur = `${cur} ${s}`.trim();
  }
  if (cur) out.push(cur);
  return out;
}

// Keep the utterances referenced: Chrome can garbage-collect them mid-speech and never fire "end".
let queue: SpeechSynthesisUtterance[] = [];
let startTimer: ReturnType<typeof setTimeout> | null = null;

export function speak(text: string, opts: { id?: string; rate?: "slow" | "normal" } = {}) {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  const id = opts.id ?? Math.random().toString(36).slice(2);
  const parts = chunkForSpeech(text);
  if (!parts.length) return;
  const wasBusy = synth.speaking || synth.pending;
  synth.cancel();
  if (startTimer) clearTimeout(startTimer);
  set({ id });
  const voice = pickVoice();
  const build = (withVoice: boolean) => parts.map((t, i) => {
    const u = new SpeechSynthesisUtterance(t);
    if (withVoice && voice) u.voice = voice;
    u.lang = (withVoice && voice?.lang) || "en-GB";
    u.rate = opts.rate === "slow" ? 0.8 : 1;
    const last = i === parts.length - 1;
    u.onend = () => { if (last && state.id === id) set({ id: null }); };
    u.onerror = (e) => { if ((e as SpeechSynthesisErrorEvent).error !== "interrupted" && state.id === id) set({ id: null }); };
    return u;
  });
  const start = (withVoice: boolean) => {
    if (state.id !== id) return;
    queue = build(withVoice);
    let started = false;
    queue[0].onstart = () => { started = true; };
    try { synth.resume(); } catch { /* ignore */ }
    queue.forEach((u) => synth.speak(u));
    // Some browsers drop speech with a chosen voice: if nothing starts, try the default voice once.
    if (withVoice && voice) {
      startTimer = setTimeout(() => { if (!started && !synth.speaking && state.id === id) { synth.cancel(); start(false); } }, 1500);
    }
  };
  // Chrome can drop an utterance queued in the same moment as cancel(): wait a beat if something was playing.
  if (wasBusy) startTimer = setTimeout(() => start(true), 120);
  else start(true);
}

export function stopSpeaking() {
  if (startTimer) clearTimeout(startTimer);
  set({ id: null });
  if (canSpeak()) window.speechSynthesis.cancel();
  queue = [];
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
