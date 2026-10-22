"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownRight, HandHeart, Lightbulb, MessageCircleQuestion, Pin, PinOff, Reply, Send, ThumbsUp, X } from "lucide-react";
import type { GroupContent } from "@/lib/modules/sessions/state";
import { Avatar, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { AiOriginBadge } from "@/components/live/ai-badge";
import { SpeechButton } from "@/components/live/speech-button";
import { Mascot } from "@/components/mascot";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";

type Msg = GroupContent["messages"][number];

const REACTIONS = [
  { kind: "applaud", label: "Applaud", icon: HandHeart },
  { kind: "agree", label: "Agree", icon: ThumbsUp },
  { kind: "build", label: "Build on this", icon: Lightbulb },
  { kind: "question", label: "I have a question", icon: MessageCircleQuestion },
] as const;

export function Chat({ className, header, empty, after, composerClassName, onActivity }: {
  className?: string; header?: React.ReactNode; empty?: React.ReactNode; after?: React.ReactNode; composerClassName?: string;
  /** Lets the page animate its helper: "typing" on each keystroke, "sent" after a message goes. */
  onActivity?: (e: "typing" | "sent") => void;
}) {
  const { group, state, act } = useWorkspace();
  const run = useRun();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const byId = useMemo(() => new Map(group.messages.map((m) => [m.id, m])), [group.messages]);
  const pinned = group.messages.filter((m) => m.pinned);
  const member = (id: string | null) => group.members.find((m) => m.id === id);
  // Messages already here when the chat opened appear still; new ones slide in.
  const [seenAtOpen] = useState(() => new Set(group.messages.map((m) => m.id)));

  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [group.messages.length, after]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    if (await run(() => act({ action: "message", body: text, replyTo: replyTo?.id ?? null }))) {
      setText("");
      setReplyTo(null);
      onActivity?.("sent");
      atBottom.current = true;
    }
    setSending(false);
  }

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-3xl border-2 border-white bg-white/85 shadow-soft", className)}>
      {header}
      {pinned.length ? (
        <div className="border-b border-line bg-amber-soft/40 px-4 py-2">
          <p className="text-xs font-semibold text-amber">Pinned</p>
          <ul className="text-sm">{pinned.slice(-3).map((m) => <li key={m.id} className="truncate"><strong>{m.author}:</strong> {m.body}</li>)}</ul>
        </div>
      ) : null}
      <div
        ref={listRef}
        onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}
        className="min-h-48 flex-1 overflow-y-auto p-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Group chat"
      >
      <ol className="flex flex-col gap-3">
        {group.messages.length === 0 ? (empty ?? (
          <li className="flex items-center gap-3 text-sm text-ink-muted"><Mascot size={40} mood="idle" />No messages yet. Chat is optional — talking in the room counts too.</li>
        )) : null}
        {group.messages.map((m) => {
          if (m.kind === "system") return <li key={m.id} className="text-center text-xs text-ink-muted">{m.body}</li>;
          const mine = m.authorId === state.me.id;
          const author = member(m.authorId);
          const parent = m.replyTo ? byId.get(m.replyTo) : null;
          return (
            <li key={m.id} className={cn("group flex gap-2.5", mine && "flex-row-reverse", !seenAtOpen.has(m.id) && "msg-in")}>
              {m.kind === "ai" ? <span className={cn("block shrink-0", !seenAtOpen.has(m.id) && "buddy-hop")}><Mascot size={36} animate={!seenAtOpen.has(m.id)} mood="happy" /></span> : <Avatar name={m.kind === "teacher" ? "Teacher" : m.author} color={m.kind === "teacher" ? "blue" : author?.avatarColor} size="sm" />}
              <div className={cn("flex max-w-[85%] flex-col gap-1", mine && "items-end")}>
                <p className="text-xs text-ink-muted">
                  <span className="font-semibold text-ink">{mine ? "You" : m.author}</span>
                  {m.kind === "ai" ? <AiOriginBadge origin={m.aiOrigin} className="ml-1.5" /> : null}
                  {m.kind === "teacher" ? <span className="ml-1.5 rounded-full bg-blue-soft px-1.5 py-0.5 text-[0.7rem] font-semibold text-blue">Teacher</span> : null}
                  <span className="ml-1.5">{new Date(m.createdAt!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                </p>
                <div className={cn("rounded-2xl px-3.5 py-2.5 text-[0.95rem]", m.kind === "ai" ? "border-2 border-[#ffd2c4] bg-[#fff6f1]" : m.kind === "teacher" ? "bg-blue-soft" : mine ? "bg-teal-soft" : "bg-surface-2")}>
                  {parent ? <p className="mb-1 flex gap-1 border-l-2 border-line-strong pl-2 text-xs text-ink-muted"><CornerDownRight className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{parent.author}: {parent.body}</span></p> : null}
                  <p className="whitespace-pre-line">{m.body}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {REACTIONS.map(({ kind, label, icon: Icon }) => {
                    const r = m.reactions.find((x) => x.kind === kind);
                    if (!r && m.kind === "system") return null;
                    return (
                      <button key={kind} type="button" aria-pressed={!!r?.mine} aria-label={`${label}${r ? ` (${r.count})` : ""}`} title={label}
                        className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs", r?.mine ? "bg-teal-soft text-teal-strong" : r ? "bg-surface-2 text-ink-muted" : "text-ink-muted [@media(hover:hover)]:opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100")}
                        onClick={() => run(() => act({ action: "react", messageId: m.id, kind }))}>
                        <Icon className="size-3.5" aria-hidden="true" />{r ? r.count : null}
                      </button>
                    );
                  })}
                  <button type="button" className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-ink-muted [@media(hover:hover)]:opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100" onClick={() => setReplyTo(m)} aria-label={`Reply to ${m.author}`}><Reply className="size-3.5" aria-hidden="true" /></button>
                  <button type="button" className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-ink-muted [@media(hover:hover)]:opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100" onClick={() => run(() => act({ action: "pin", messageId: m.id }))} aria-label={m.pinned ? "Unpin" : "Pin for the group"}>{m.pinned ? <PinOff className="size-3.5" aria-hidden="true" /> : <Pin className="size-3.5" aria-hidden="true" />}</button>
                </div>
              </div>
            </li>
          );
        })}
        {after}
      </ol>
      </div>
      <form className={cn("flex flex-col gap-2 border-t border-line p-3", composerClassName)} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        {replyTo ? (
          <p className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1 text-xs">
            <Reply className="size-3.5" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">Replying to {replyTo.author}: {replyTo.body}</span>
            <button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X className="size-3.5" /></button>
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">Message your group</label>
          <Textarea id="chat-input" rows={1} className="min-h-11 flex-1 resize-none" value={text} maxLength={2000}
            onChange={(e) => { setText(e.target.value); onActivity?.("typing"); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Message your group…" title="Enter to send · Shift+Enter for a new line" />
          <Button type="submit" size="icon" aria-label="Send message" pending={sending} disabled={!text.trim()}><Send /></Button>
        </div>
        <SpeechButton onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
      </form>
    </div>
  );
}
