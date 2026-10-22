"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function Materials({ materials, className }: { materials: { id: string; title: string; kind: string; body: string }[]; className?: string }) {
  if (!materials.length) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <h3 className="text-sm font-semibold">Lesson materials</h3>
      {materials.map((m) => (
        <details key={m.id} className="rounded-xl border border-line bg-surface px-3 py-2 open:pb-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><FileText className="size-4 text-ink-muted" aria-hidden="true" />{m.title}</summary>
          {m.kind === "text" ? (
            <div className="mt-2 max-h-[50dvh] overflow-y-auto whitespace-pre-line font-serif text-[1.02rem] leading-relaxed">{m.body}</div>
          ) : (
            <a className="mt-2 inline-block text-sm text-teal underline" href={`/api/materials/${m.id}`} target="_blank" rel="noreferrer">Open file</a>
          )}
        </details>
      ))}
    </div>
  );
}
