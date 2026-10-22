"use client";

import * as React from "react";
import { Dialog as RDialog, Tabs as RTabs, Switch as RSwitch } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = RDialog.Root;
export const DialogTrigger = RDialog.Trigger;
export const DialogClose = RDialog.Close;

export function DialogContent({
  title, description, children, className, wide,
}: { title: string; description?: string; children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" />
      <RDialog.Content
        className={cn(
          "animate-pop fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-lift",
          wide ? "max-w-3xl" : "max-w-lg",
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <RDialog.Title className="font-display text-xl font-semibold">{title}</RDialog.Title>
            {description ? <RDialog.Description className="mt-1 text-sm text-ink-muted">{description}</RDialog.Description> : <RDialog.Description className="sr-only">{title}</RDialog.Description>}
          </div>
          <RDialog.Close className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </RDialog.Close>
        </div>
        {children}
      </RDialog.Content>
    </RDialog.Portal>
  );
}

/** Side panel (sheet) built on Dialog: used for private AI, help, settings. */
export function SheetContent({
  title, description, children, side = "right", className,
}: { title: string; description?: string; children: React.ReactNode; side?: "right" | "left"; className?: string }) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay className="fixed inset-0 z-50 bg-ink/20" />
      <RDialog.Content
        className={cn(
          "fixed top-0 z-50 flex h-dvh w-full max-w-md flex-col border-line bg-surface shadow-lift",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <RDialog.Title className="font-display text-lg font-semibold">{title}</RDialog.Title>
            {description ? <RDialog.Description className="text-sm text-ink-muted">{description}</RDialog.Description> : <RDialog.Description className="sr-only">{title}</RDialog.Description>}
          </div>
          <RDialog.Close className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2" aria-label="Close panel">
            <X className="size-5" />
          </RDialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </RDialog.Content>
    </RDialog.Portal>
  );
}

export const Tabs = RTabs.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof RTabs.List>) {
  return <RTabs.List className={cn("inline-flex gap-1 rounded-xl bg-surface-2 p-1", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-muted data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-soft [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
export const TabsContent = RTabs.Content;

export function Switch({ label, description, checked, onCheckedChange, id, disabled }: {
  label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void; id: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      </div>
      <RSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="relative h-6 w-11 shrink-0 rounded-full bg-line-strong transition-colors data-[state=checked]:bg-teal disabled:opacity-50"
      >
        <RSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
      </RSwitch.Root>
    </div>
  );
}
