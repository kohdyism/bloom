"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Send, LifeBuoy } from "lucide-react";
import { Dialog, SheetContent } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Notice, Textarea } from "@/components/ui/primitives";
import { Mascot } from "@/components/mascot";
import { AiOriginBadge } from "@/components/live/ai-badge";
import { SpeechButton } from "@/components/live/speech-button";
import { api } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";

type PMsg = { id: string; role: string; action: string; origin: string | null; body: string; createdAt: string };

const QUICK = [
  ["explain_simply", "Explain simply"],
  ["break_into_steps", "Break into steps"],
  ["show_example", "Show an example"],
  ["what_is_group_doing", "What's my group doing?"],
  ["summarise_discussion", "Summarise the discussion"],
  ["express_idea", "Help me express my idea"],
  ["prepare_to_contribute", "Help me prepare to contribute"],
  ["stuck", "I'm stuck"],
] as const;

/**
 * Private learning assistant (spec §17). Only this student sees the
 * conversation; the teacher sees counts by type, not the words. The notice
 * below says exactly that — it is never described as absolutely confidential.
 */
export function AssistantPanel({ open, onOpenChange, prefill, tick }: { open: boolean; onOpenChange: (o: boolean) => void; prefill?: { action?: string; text?: string }; tick: number }) {
  const { sessionId } = useWorkspace();
  const [messages, setMessages] = useState<PMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const handledPrefill = useRef<typeof prefill>(undefined);

  async function load() {
    try {
      const r = await api<{ messages: PMsg[] }>(`/api/live/student/${sessionId}/assistant`);
      setMessages(r.messages);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    // Fetching the private conversation when the panel opens (async; not derived state).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tick]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, busy]);

  async function ask(request: string, extra?: string) {
    setBusy(true);
    setError(null);
    const optimistic: PMsg = { id: `tmp-${Date.now()}`, role: "student", action: request, origin: null, body: request === "question" ? extra ?? "" : QUICK.find((q) => q[0] === request)?.[1] ?? request, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      await api("/api/live/student", { method: "POST", json: { action: "assistant", sessionId, request, text: extra || undefined } });
      if (request === "question") setText("");
      await load();
    } catch (e) {
      setError((e as Error).message);
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (open && prefill?.action && handledPrefill.current !== prefill) {
      handledPrefill.current = prefill;
      void ask(prefill.action, prefill.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Ask Sprout" description="Your private learning helper">
        <div className="flex h-full flex-col">
          <Notice tone="purple" className="m-4 mb-2">
            <span className="flex items-start gap-2"><Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Your group can&apos;t see this. Your teacher sees only how many times you asked for each kind of help — not what you wrote. Sprout gives hints and explanations, not your group&apos;s answers.</span></span>
          </Notice>
          <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-2" aria-label="Conversation with Sprout" role="log" aria-live="polite">
            {messages.length === 0 && !busy ? (
              <li className="flex items-center gap-3 text-sm text-ink-muted"><Mascot size={44} mood="wave" />Pick a button below or type your own question. Nothing is too small to ask.</li>
            ) : null}
            {messages.map((m) => (
              <li key={m.id} className={cn("flex flex-col gap-1", m.role === "student" ? "items-end" : "items-start")}>
                {m.role !== "student" ? <AiOriginBadge origin={m.origin} /> : null}
                <div className={cn("max-w-[90%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[0.95rem]", m.role === "student" ? "bg-teal-soft" : "border border-purple/25 bg-purple-soft/40")}>
                  <span className="sr-only">{m.role === "student" ? "You: " : "Sprout: "}</span>{m.body}
                </div>
                {m.role !== "student" && /Need help/.test(m.body) ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-coral"><LifeBuoy className="size-3.5" aria-hidden="true" />Use the “Need help” button at the top to reach your teacher.</span> : null}
              </li>
            ))}
            {busy ? <li className="flex items-center gap-2 text-sm text-ink-muted" role="status"><Mascot size={28} mood="thinking" animate={false} />Sprout is thinking…</li> : null}
          </ol>
          {error ? <Notice tone="coral" className="mx-4" role="alert">{error} Your lesson work isn&apos;t affected.</Notice> : null}
          <div className="border-t border-line p-4">
            <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Quick help">
              {QUICK.map(([key, label]) => (
                <button key={key} type="button" disabled={busy} onClick={() => ask(key, key === "express_idea" ? text : undefined)} className="rounded-full border border-purple/30 bg-surface px-3 py-1.5 text-sm hover:bg-purple-soft disabled:opacity-50">{label}</button>
              ))}
            </div>
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void ask("question", text); }}>
              <label htmlFor="assistant-input" className="sr-only">Your question</label>
              <Textarea id="assistant-input" rows={2} className="flex-1" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Ask anything about the task…" />
              <Button type="submit" size="icon" aria-label="Ask" disabled={!text.trim() || busy}><Send /></Button>
            </form>
            <SpeechButton className="mt-1" onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
          </div>
        </div>
      </SheetContent>
    </Dialog>
  );
}
