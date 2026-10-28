"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CornerDownRight, HandHeart, Lightbulb, MessageCircleQuestion, Pin, PinOff, Reply, Send, ThumbsUp, X } from "lucide-react";
import type { GroupContent } from "@/lib/modules/sessions/state";
import { Avatar, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { AiOriginBadge } from "@/components/live/ai-badge";
import { SpeechButton } from "@/components/live/speech-button";
import { Mascot } from "@/components/mascot";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ReadAloudButton } from "@/components/read-aloud";
import { useWorkspace } from "./context";

type Msg = GroupContent["messages"][number];

const REACTIONS = [
  { kind: "applaud", label: "Applaud", icon: HandHeart },
  { kind: "agree", label: "Agree", icon: ThumbsUp },
  { kind: "build", label: "Build on this", icon: Lightbulb },
  { kind: "question", label: "I have a question", icon: MessageCircleQuestion },
] as const;

export function Chat({ className, header, empty, after, composerClassName, onActivity, inline, compact = false, placeholder = "Message your group…", show }: {
  className?: string; header?: React.ReactNode; empty?: React.ReactNode; after?: React.ReactNode; composerClassName?: string;
  /** Something embedded in the conversation (the stage's task card), placed after messages up to `after`. */
  inline?: { node: React.ReactNode; after: string | null; key: string };
  /** Slim layout for a side column. */
  compact?: boolean;
  placeholder?: string;
  /** Which messages to show (e.g. leave Bloom's out when Bloom speaks elsewhere). */
  show?: (m: Msg) => boolean;
  /** Lets the page animate its helper: "typing" on each keystroke, "sent" after a message goes. */
  onActivity?: (e: "typing" | "sent", text?: string) => void;
}) {
  const { group, state, act } = useWorkspace();
  const msgs = useMemo(() => (show ? group.messages.filter(show) : group.messages), [group.messages, show]);
  const run = useRun();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [sending, setSending] = useState(false);
  const [held, setHeld] = useState<{ note: string; verdict: string } | null>(null);
  const supervised = !!state.session.chatSupervised;
  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const byId = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs]);
  const pinned = msgs.filter((m) => m.pinned);
  const member = (id: string | null) => group.members.find((m) => m.id === id);
  // Messages already here when the chat opened appear still; new ones slide in.
  const [seenAtOpen] = useState(() => new Set(msgs.map((m) => m.id)));

  // New messages: follow along when you're at the bottom; otherwise offer a way down.
  const [unseen, setUnseen] = useState(0);
  const lastCount = useRef(msgs.length);
  useEffect(() => {
    const el = listRef.current;
    const added = msgs.length - lastCount.current;
    lastCount.current = msgs.length;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
    // Counting arrivals while scrolled up (a reaction to new server data).
    else if (added > 0) setUnseen((n) => n + added);
  }, [msgs.length, after]);
  const toBottom = () => { const el = listRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); setUnseen(0); };

  // A new stage: bring its task card into view.
  const inlineKey = inline?.key;
  useEffect(() => {
    if (!inlineKey) return;
    const t = setTimeout(() => document.getElementById("task-card")?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [inlineKey]);

  // "Back to your task" appears when the task card has scrolled out of view.
  const [taskHidden, setTaskHidden] = useState<"above" | "below" | null>(null);
  useEffect(() => {
    const root = listRef.current;
    const card = document.getElementById("task-card");
    if (!inlineKey || !root || !card || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setTaskHidden(null);
      else setTaskHidden(e.boundingClientRect.top < (e.rootBounds?.top ?? 0) ? "above" : "below");
    }, { root, threshold: 0.08 });
    io.observe(card);
    return () => io.disconnect();
  }, [inlineKey]);
  const cut = inline ? (() => {
    const t = inline.after ? new Date(inline.after).getTime() : -Infinity;
    let i = msgs.findIndex((m) => new Date(m.createdAt!).getTime() > t + 1500);
    if (i === -1) return msgs.length;
    // Bloom's welcome to the stage reads best just above the task it introduces.
    const m = msgs[i];
    if (m.kind === "ai" && new Date(m.createdAt!).getTime() < t + 45_000) i++;
    return i;
  })() : msgs.length;

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    setHeld(null);
    let result: unknown = null;
    if (await run(async () => { result = await act({ action: "message", body: text, replyTo: replyTo?.id ?? null }); })) {
      const h = (result as { held?: { note: string; verdict: string } } | null)?.held;
      if (h) {
        // Supervised chat: Bloom kept this one back. Only the writer sees why; the text stays to edit.
        setHeld(h);
        if (h.verdict === "safeguarding") setText("");
      } else {
        setText("");
        setReplyTo(null);
        onActivity?.("sent", text);
        atBottom.current = true;
      }
    }
    setSending(false);
  }

  const renderMsg = (m: Msg) => {
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
                  <p className="whitespace-pre-line">{m.body}<ReadAloudButton text={`${m.author} said: ${m.body}`} label="Read this message aloud" className="-my-1 ml-1 align-middle" /></p>
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
        };

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
        onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; if (atBottom.current && unseen) setUnseen(0); }}
        className={cn("relative flex-1 overflow-y-auto", compact ? "min-h-16 p-3" : "min-h-48 p-4 sm:px-6")}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Group chat"
      >
      {taskHidden ? (
        <button type="button" onClick={() => document.getElementById("task-card")?.scrollIntoView({ block: "start", behavior: "smooth" })}
          className="sticky top-0 z-10 mx-auto mb-2 flex w-fit items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white shadow-lift">
          <ArrowUp className={cn("size-4", taskHidden === "below" && "rotate-180")} aria-hidden="true" />Back to your task
        </button>
      ) : null}
      <ol className="flex flex-col gap-3">
        {msgs.length === 0 ? (empty ?? (
          <li className="flex items-center gap-3 text-sm text-ink-muted"><Mascot size={40} mood="idle" />No messages yet. Chat is optional — talking in the room counts too.</li>
        )) : null}
        {(inline ? msgs.slice(0, cut) : msgs).map(renderMsg)}
        {inline ? null : <>{after}</>}
      </ol>
      {inline ? (
        <>
          <div key={inline.key} className="my-3">{inline.node}</div>
          <ol className="flex flex-col gap-3">
            {msgs.slice(cut).map(renderMsg)}
            {after}
          </ol>
        </>
      ) : null}
      {unseen > 0 ? (
        <button type="button" onClick={toBottom} className="sticky bottom-0 z-10 mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-white shadow-lift">
          <ArrowDown className="size-4" aria-hidden="true" />{unseen} new message{unseen === 1 ? "" : "s"}
        </button>
      ) : null}
      </div>
      <form className={cn("flex flex-col gap-2 border-t border-line p-3", composerClassName)} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        {held ? (
          <p className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-sm", held.verdict === "safeguarding" ? "border-purple/40 bg-purple-soft" : "border-[#ffd2c4] bg-[#fff6f1]")} role="status">
            {held.verdict === "safeguarding" ? null : <span className="shrink-0 font-semibold text-[#c4420a]">Not sent.</span>}
            <span className="min-w-0 flex-1">{held.note} {held.verdict === "safeguarding" ? null : <span className="text-ink-muted">Edit it and try again.</span>}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setHeld(null)}><X className="size-4" /></button>
          </p>
        ) : supervised ? <p className="text-xs text-ink-muted">Bloom checks messages before they&apos;re shared, to keep the chat on task.</p> : null}
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
            placeholder={placeholder} title="Enter to send · Shift+Enter for a new line" />
          <Button type="submit" size="icon" aria-label="Send message" pending={sending} disabled={!text.trim()}><Send /></Button>
        </div>
        <SpeechButton onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
      </form>
    </div>
  );
}
