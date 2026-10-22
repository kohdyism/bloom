"use client";

import { Wifi, WifiOff } from "lucide-react";
import type { ConnectionState } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";

export function ConnectionStatus({ state, className }: { state: ConnectionState; className?: string }) {
  const map = {
    open: { label: "Live", tone: "text-mint", icon: Wifi },
    connecting: { label: "Connecting…", tone: "text-ink-muted", icon: Wifi },
    reconnecting: { label: "Reconnecting — your work is saved", tone: "text-amber", icon: WifiOff },
    offline: { label: "Offline — changes will sync when you reconnect", tone: "text-coral", icon: WifiOff },
  } as const;
  const m = map[state];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", m.tone, className)} role="status" aria-live="polite">
      <Icon className="size-3.5" aria-hidden="true" />
      <span className={state === "open" ? "sr-only sm:not-sr-only" : undefined}>{m.label}</span>
    </span>
  );
}
