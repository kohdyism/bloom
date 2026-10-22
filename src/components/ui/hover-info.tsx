"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Details on hover — that also work by tap and keyboard. Mouse users get the
 * card on hover (with a short delay); touch and keyboard users press the
 * trigger to toggle it. The trigger must be a single focusable element.
 */
export function HoverInfo({ children, content, side = "bottom", align = "center", className, openDelay = 180, suppress = false }: {
  children: React.ReactElement; content: React.ReactNode; side?: "top" | "right" | "bottom" | "left"; align?: "start" | "center" | "end"; className?: string; openDelay?: number;
  /** Keep the card closed for now (e.g. while the trigger is showing something else). */
  suppress?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current) clearTimeout(timer.current); };
  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clear();
    timer.current = setTimeout(() => setOpen(true), openDelay);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clear();
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  React.useEffect(() => clear, []);
  return (
    <Popover.Root open={open && !suppress} onOpenChange={setOpen}>
      <Popover.Trigger asChild onPointerEnter={hoverOpen} onPointerLeave={hoverClose}>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn("animate-pop z-50 max-w-xs rounded-2xl border border-line bg-surface p-3.5 text-sm text-ink shadow-lift", className)}
        >
          {content}
          <Popover.Arrow className="fill-[var(--surface)]" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
