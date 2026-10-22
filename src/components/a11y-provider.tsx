"use client";

import * as React from "react";
import { DEFAULT_A11Y, parseA11y, type AccessibilityPrefs } from "@/lib/domain/accessibility";

type Ctx = {
  prefs: AccessibilityPrefs;
  update: (patch: Partial<AccessibilityPrefs>) => void;
  saving: "idle" | "saving" | "saved" | "error";
};

const A11yContext = React.createContext<Ctx>({ prefs: DEFAULT_A11Y, update: () => {}, saving: "idle" });

const LOCAL_KEY = "bloom.a11y";

function apply(p: AccessibilityPrefs) {
  const el = document.documentElement;
  el.dataset.text = p.textSize;
  el.dataset.contrast = p.contrast;
  el.dataset.motion = p.motion;
}

function readLocal(fallback: AccessibilityPrefs): AccessibilityPrefs {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(LOCAL_KEY);
    return stored ? parseA11y(JSON.parse(stored)) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Accessibility preferences follow the student across devices: they are
 * stored server-side for students (persist = "server") and in localStorage
 * for teachers and the public display.
 */
export function A11yProvider({ initial, persist, children }: { initial: AccessibilityPrefs; persist: "server" | "local"; children: React.ReactNode }) {
  const [prefs, setPrefs] = React.useState(() => (persist === "local" ? readLocal(initial) : initial));
  const [saving, setSaving] = React.useState<Ctx["saving"]>("idle");

  // Keep the <html> data attributes in sync (external DOM, no React state).
  React.useEffect(() => {
    apply(prefs);
  }, [prefs]);

  const update = React.useCallback(
    (patch: Partial<AccessibilityPrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        if (persist === "local") {
          try {
            window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
          } catch {
            /* storage unavailable: still applies for this visit */
          }
        } else {
          setSaving("saving");
          fetch("/api/me/accessibility", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) })
            .then((r) => setSaving(r.ok ? "saved" : "error"))
            .catch(() => setSaving("error"));
        }
        return next;
      });
    },
    [persist],
  );

  return <A11yContext.Provider value={{ prefs, update, saving }}>{children}</A11yContext.Provider>;
}

export function useA11y() {
  return React.useContext(A11yContext);
}

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True when the student or the OS asked for reduced motion. */
export function useReducedMotion() {
  const { prefs } = useA11y();
  const os = React.useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  return prefs.motion === "reduce" || os;
}
