"use client";

import { useState } from "react";
import { Lock, Send } from "lucide-react";
import type { StudentState } from "@/lib/modules/sessions/state";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Badge, Notice, Textarea } from "@/components/ui/primitives";
import { HELP_REASONS, HELP_STATUS_LABEL, helpLabel, type HelpReason } from "@/lib/domain/help";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { StudentAction } from "./context";

/**
 * Discreet teacher assistance (spec §22). Requests and messages go only to
 * the teacher; groupmates are never notified.
 */
export function HelpPanel({ state, sessionId, act, trigger }: { state: StudentState; sessionId: string; act: (b: StudentAction) => Promise<unknown>; trigger: React.ReactNode }) {
  const [reason, setReason] = useState<HelpReason | null>(null);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const run = useRun();
  const open = state.help.filter((h) => h.status !== "resolved");
  void sessionId;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <SheetContent title="Ask your teacher" description="Only your teacher sees this — not your group.">
        <div className="flex flex-col gap-6 p-5">
          {state.help.length ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Your requests</h3>
              <ul className="flex flex-col gap-2">
                {state.help.slice(0, 5).map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    <span>{helpLabel(h.reason)}</span>
                    <Badge tone={h.status === "resolved" ? "mint" : h.status === "sent" ? "amber" : "blue"}>{HELP_STATUS_LABEL[h.status]}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {state.thread.length ? (
            <section aria-label="Messages with your teacher">
              <h3 className="mb-2 text-sm font-semibold">Messages</h3>
              <ul className="flex flex-col gap-2">
                {state.thread.map((m) => (
                  <li key={m.id} className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", m.fromMe ? "self-end bg-teal-soft" : "self-start bg-surface-2")}>
                    <span className="sr-only">{m.fromMe ? "You" : "Teacher"}: </span>{m.body}
                  </li>
                ))}
              </ul>
              <form className="mt-3 flex gap-2" onSubmit={async (e) => {
                e.preventDefault();
                if (!reply.trim()) return;
                if (await run(() => act({ action: "message_teacher", body: reply, helpRequestId: open[0]?.id ?? null }))) setReply("");
              }}>
                <label htmlFor="reply-teacher" className="sr-only">Reply to your teacher</label>
                <Textarea id="reply-teacher" rows={1} className="min-h-11" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" />
                <Button type="submit" size="icon" aria-label="Send reply"><Send /></Button>
              </form>
            </section>
          ) : null}

          <form className="flex flex-col gap-3" onSubmit={async (e) => {
            e.preventDefault();
            if (!reason) return;
            setSending(true);
            const ok = await run(() => act({ action: "help", reason, message }), "Sent to your teacher");
            if (ok) { setReason(null); setMessage(""); }
            setSending(false);
          }}>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">What do you need?</legend>
              {HELP_REASONS.map((r) => (
                <label key={r.key} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]", reason === r.key ? "border-teal bg-teal-soft" : "border-line")}>
                  <input type="radio" name="help-reason" value={r.key} checked={reason === r.key} onChange={() => setReason(r.key)} className="accent-[var(--teal)]" />
                  {r.label}
                </label>
              ))}
            </fieldset>
            {reason === "uncomfortable" ? (
              <Notice tone="coral">Your teacher will see this straight away as urgent. If you feel unsafe right now, go and speak to your teacher or another adult in person.</Notice>
            ) : null}
            <label htmlFor="help-msg" className="text-sm font-semibold">Add a message <span className="font-normal text-ink-muted">(optional)</span></label>
            <Textarea id="help-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
            <Button type="submit" disabled={!reason} pending={sending}><Send />Send to my teacher</Button>
            <p className="flex items-start gap-1.5 text-xs text-ink-muted"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Your group won&apos;t be told. Your teacher may follow school safeguarding procedures if you tell them you&apos;re not safe.</p>
          </form>
        </div>
      </SheetContent>
    </Dialog>
  );
}
