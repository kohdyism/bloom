"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Send, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice, Textarea } from "@/components/ui/primitives";
import { Pip } from "@/components/mascot";
import { Buddy } from "@/components/buddy";
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
export function PipChat({ active, prefill, tick, className, composerClassName }: { active: boolean; prefill?: { action?: string; text?: string }; tick: number; className?: string; composerClassName?: string }) {
  const open = active;
  const [more, setMore] = useState(false);
  const { sessionId } = useWorkspace();
  const [messages, setMessages] = useState<PMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
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

  const quick = more ? QUICK : QUICK.filter(([k]) => ["explain_simply", "break_into_steps", "show_example", "stuck"].includes(k));
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <p className="mx-4 mt-3 flex items-start gap-2 rounded-2xl bg-purple-soft px-3 py-2 text-sm"><Lock className="mt-0.5 size-4 shrink-0 text-purple-strong" aria-hidden="true" /><span>Only you can see this. Your teacher sees how many times you asked for each kind of help — not what you wrote. Pip gives hints, not answers.</span></p>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-label="Conversation with Pip" role="log" aria-live="polite">
      <ol className="flex flex-col gap-3">
        {messages.length === 0 && !busy ? (
          <li className="flex flex-col items-center gap-3 py-6 text-center text-ink-muted"><Buddy who="pip" size={110} mood="happy" /><span className="max-w-xs">Hi, I&apos;m Pip. Ask me anything about the task — nothing is too small.</span></li>
        ) : null}
        {messages.map((m) => (
          <li key={m.id} className={cn("flex gap-2.5", m.role === "student" ? "flex-row-reverse" : "")}>
            {m.role !== "student" ? <Pip size={36} animate={false} mood="happy" /> : null}
            <div className={cn("flex max-w-[85%] flex-col gap-1", m.role === "student" ? "items-end" : "items-start")}>
              {m.role !== "student" ? <p className="flex items-center gap-1.5 text-xs text-ink-muted"><span className="font-semibold text-ink">Pip</span><AiOriginBadge origin={m.origin} /></p> : null}
              <div className={cn("whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[0.95rem]", m.role === "student" ? "bg-teal-soft" : "border-2 border-purple/25 bg-[#f6f2ff]")}>
                <span className="sr-only">{m.role === "student" ? "You: " : "Pip: "}</span>{m.body}
              </div>
              {m.role !== "student" && /Need help/.test(m.body) ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-coral"><LifeBuoy className="size-3.5" aria-hidden="true" />Use the “Need help” button at the top to reach your teacher.</span> : null}
            </div>
          </li>
        ))}
        {busy ? <li className="flex items-center gap-2 text-sm text-ink-muted" role="status"><Pip size={30} mood="thinking" animate={false} />Pip is thinking…</li> : null}
      </ol>
      </div>
      {error ? <Notice tone="coral" className="mx-4" role="alert">{error} Your lesson work isn&apos;t affected.</Notice> : null}
      <div className={cn("flex flex-col gap-2 border-t border-line p-3", composerClassName)}>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick help">
          {quick.map(([key, label]) => (
            <button key={key} type="button" disabled={busy} onClick={() => ask(key, key === "express_idea" ? text : undefined)} className="rounded-full border-2 border-purple/30 bg-white px-3 py-1 text-sm font-medium hover:border-purple hover:bg-purple-soft disabled:opacity-50">{label}</button>
          ))}
          <button type="button" onClick={() => setMore((m) => !m)} className="px-2 text-sm font-semibold text-purple underline-offset-4 hover:underline" aria-expanded={more}>{more ? "Fewer" : "More"}</button>
        </div>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void ask("question", text); }}>
          <label htmlFor="assistant-input" className="sr-only">Your question for Pip</label>
          <Textarea id="assistant-input" rows={1} className="min-h-11 flex-1 resize-none" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) void ask("question", text); } }} maxLength={2000} placeholder="Ask Pip anything about the task…" />
          <Button type="submit" size="icon" aria-label="Ask" disabled={!text.trim() || busy} className="bg-purple hover:bg-purple-strong"><Send /></Button>
        </form>
        <SpeechButton onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
      </div>
    </div>
  );
}
