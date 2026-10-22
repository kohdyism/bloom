"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

/**
 * Optional speech-to-text using the browser's Web Speech API. It only listens
 * between the user pressing start and stop — never continuously, never in the
 * background, and nothing is recorded by Bloom. Falls back gracefully when the
 * browser doesn't support it or microphone permission is refused.
 */
export function useSpeechInput(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const cb = useRef(onText);
  useEffect(() => {
    cb.current = onText;
  });

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-GB";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results).map((x) => x[0].transcript).join(" ").trim();
      if (text) cb.current(text);
    };
    r.onerror = (e) => {
      setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microphone access is blocked. You can type instead, or allow the microphone in your browser settings." : e.error === "no-speech" ? "We didn't catch that — try again or type instead." : "Speech input stopped. You can type instead.");
      setListening(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    queueMicrotask(() => setSupported(true));
    return () => {
      try { r.stop(); } catch { /* not started */ }
    };
  }, []);

  const toggle = useCallback(() => {
    const r = rec.current;
    if (!r) return;
    setError(null);
    if (listening) {
      r.stop();
      setListening(false);
    } else {
      try {
        r.start();
        setListening(true);
      } catch {
        setError("Speech input couldn't start. You can type instead.");
      }
    }
  }, [listening]);

  return { supported, listening, error, toggle };
}
