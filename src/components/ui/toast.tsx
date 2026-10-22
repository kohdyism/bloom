"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; title: string; body?: string; tone: "neutral" | "teal" | "coral" | "amber" | "purple"; action?: { label: string; onClick: () => void } };
const Ctx = React.createContext<(t: Omit<Toast, "id">) => void>(() => {});

/** Calm, non-blocking notifications announced politely to screen readers. */
export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-1), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), t.tone === "coral" ? 12000 : 4500);
  }, []);
  const tones = {
    neutral: "border-line", teal: "border-teal/40", coral: "border-coral/60 bg-coral-soft", amber: "border-amber/50 bg-amber-soft", purple: "border-purple/40",
  };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-28 left-6 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn("animate-pop pointer-events-auto rounded-xl border bg-surface p-3.5 shadow-lift", tones[t.tone])}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.body ? <p className="mt-0.5 text-sm text-ink-muted">{t.body}</p> : null}
                {t.action ? <button className="mt-1.5 text-sm font-semibold text-teal underline" onClick={t.action.onClick}>{t.action.label}</button> : null}
              </div>
              <button aria-label="Dismiss notification" className="rounded p-0.5 text-ink-muted hover:text-ink" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}><X className="size-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return React.useContext(Ctx);
}

/** Wrap an async action: show its error as a toast, return whether it succeeded. */
export function useRun() {
  const toast = useToast();
  return React.useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      try {
        await fn();
        if (success) toast({ title: success, tone: "teal" });
        return true;
      } catch (e) {
        toast({ title: "That didn't work", body: (e as Error).message, tone: "coral" });
        return false;
      }
    },
    [toast],
  );
}
