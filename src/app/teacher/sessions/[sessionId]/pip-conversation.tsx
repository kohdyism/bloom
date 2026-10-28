"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { api } from "@/lib/realtime/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { Notice } from "@/components/ui/primitives";
import { AiOriginBadge } from "@/components/live/ai-badge";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: string; action: string; origin: string | null; body: string; createdAt: string };

/** Read exactly what one student wrote to Pip, and Pip's replies. Opening it is recorded in the audit log. */
export function PipConversation({ sessionId, studentId, studentName }: { sessionId: string; studentId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const show = async () => {
    setOpen(true);
    setError(null);
    try { setMsgs((await api<{ messages: Msg[] }>(`/api/live/teacher/${sessionId}/pip/${studentId}`)).messages); } catch (e) { setError((e as Error).message); }
  };
  return (
    <>
      <Button size="sm" variant="ghost" onClick={show}><Eye />Read Pip chat</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`${studentName} and Pip`} description="Exactly what they wrote to Pip, and Pip's replies. Their group never sees this. This view is recorded in the audit log." wide>
          {error ? <Notice tone="coral">{error}</Notice> : !msgs ? <p className="text-ink-muted">Loading…</p> : msgs.length === 0 ? <p className="text-ink-muted">{studentName} hasn&apos;t asked Pip anything in this lesson.</p> : (
            <ol className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {msgs.map((m) => (
                <li key={m.id} className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm", m.role === "student" ? "self-end bg-teal-soft" : "self-start border-2 border-purple/25 bg-[#f6f2ff]")}>
                  <p className="mb-0.5 flex items-center gap-2 text-xs font-semibold text-ink-muted">
                    {m.role === "student" ? studentName : "Pip"} · {new Date(m.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    {m.role !== "student" ? <AiOriginBadge origin={m.origin as never} /> : null}
                  </p>
                  <p className="whitespace-pre-line">{m.body}</p>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
