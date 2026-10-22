"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownRight, HandHeart, Lightbulb, MessageCircleQuestion, Pin, PinOff, Reply, Send, ThumbsUp, X, PlusCircle } from "lucide-react";
import type { GroupContent } from "@/lib/modules/sessions/state";
import { Dialog, SheetContent } from "@/components/ui/overlay";
import { Avatar, Card, Textarea } from "@/components/ui/primitives";
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

export function Chat({ className }: { className?: string }) {
  const { group, state, act } = useWorkspace();
  const run = useRun();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const atBottom = useRef(true);
  const byId = useMemo(() => new Map(group.messages.map((m) => [m.id, m])), [group.messages]);
  const pinned = group.messages.filter((m) => m.pinned);
  const member = (id: string | null) => group.members.find((m) => m.id === id);

  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [group.messages.length]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    if (await run(() => act({ action: "message", body: text, replyTo: replyTo?.id ?? null }))) {
      setText("");
      setReplyTo(null);
      atBottom.current = true;
    }
    setSending(false);
  }

  return (
    <div className={cn("flex min-h-0 flex-col rounded-2xl border border-line bg-surface", className)}>
      {pinned.length ? (
        <div className="border-b border-line bg-amber-soft/40 px-4 py-2">
          <p className="text-xs font-semibold text-amber">Pinned</p>
          <ul className="text-sm">{pinned.slice(-3).map((m) => <li key={m.id} className="truncate"><strong>{m.author}:</strong> {m.body}</li>)}</ul>
        </div>
      ) : null}
      <ol
        ref={listRef}
        onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}
        className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto p-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Group chat"
      >
        {group.messages.length === 0 ? (
          <li className="flex items-center gap-3 text-sm text-ink-muted"><Mascot size={40} mood="idle" />No messages yet. Chat is optional — talking in the room counts too.</li>
        ) : null}
        {group.messages.map((m) => {
          if (m.kind === "system") return <li key={m.id} className="text-center text-xs text-ink-muted">{m.body}</li>;
          const mine = m.authorId === state.me.id;
          const author = member(m.authorId);
          const parent = m.replyTo ? byId.get(m.replyTo) : null;
          return (
            <li key={m.id} className={cn("group flex gap-2.5", mine && "flex-row-reverse")}>
              {m.kind === "ai" ? <Mascot size={32} animate={false} /> : <Avatar name={m.kind === "teacher" ? "Teacher" : m.author} color={m.kind === "teacher" ? "blue" : author?.avatarColor} size="sm" />}
              <div className={cn("flex max-w-[85%] flex-col gap-1", mine && "items-end")}>
                <p className="text-xs text-ink-muted">
                  <span className="font-semibold text-ink">{mine ? "You" : m.author}</span>
                  {m.kind === "ai" ? <AiOriginBadge origin={m.aiOrigin} className="ml-1.5" /> : null}
                  {m.kind === "teacher" ? <span className="ml-1.5 rounded-full bg-blue-soft px-1.5 py-0.5 text-[0.7rem] font-semibold text-blue">Teacher</span> : null}
                  <span className="ml-1.5">{new Date(m.createdAt!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                </p>
                <div className={cn("rounded-2xl px-3.5 py-2.5 text-[0.95rem]", m.kind === "ai" ? "border border-purple/30 bg-purple-soft/50" : m.kind === "teacher" ? "bg-blue-soft" : mine ? "bg-teal-soft" : "bg-surface-2")}>
                  {parent ? <p className="mb-1 flex gap-1 border-l-2 border-line-strong pl-2 text-xs text-ink-muted"><CornerDownRight className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{parent.author}: {parent.body}</span></p> : null}
                  <p className="whitespace-pre-line">{m.body}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {REACTIONS.map(({ kind, label, icon: Icon }) => {
                    const r = m.reactions.find((x) => x.kind === kind);
                    if (!r && m.kind === "system") return null;
                    return (
                      <button key={kind} type="button" aria-pressed={!!r?.mine} aria-label={`${label}${r ? ` (${r.count})` : ""}`} title={label}
                        className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs", r?.mine ? "bg-teal-soft text-teal-strong" : r ? "bg-surface-2 text-ink-muted" : "text-ink-faint opacity-60 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100")}
                        onClick={() => run(() => act({ action: "react", messageId: m.id, kind }))}>
                        <Icon className="size-3.5" aria-hidden="true" />{r ? r.count : null}
                      </button>
                    );
                  })}
                  <button type="button" className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-ink-faint opacity-60 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100" onClick={() => setReplyTo(m)} aria-label={`Reply to ${m.author}`}><Reply className="size-3.5" aria-hidden="true" /></button>
                  <button type="button" className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-ink-faint opacity-60 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100" onClick={() => run(() => act({ action: "pin", messageId: m.id }))} aria-label={m.pinned ? "Unpin" : "Pin for the group"}>{m.pinned ? <PinOff className="size-3.5" aria-hidden="true" /> : <Pin className="size-3.5" aria-hidden="true" />}</button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <form className="flex flex-col gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        {replyTo ? (
          <p className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1 text-xs">
            <Reply className="size-3.5" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">Replying to {replyTo.author}: {replyTo.body}</span>
            <button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X className="size-3.5" /></button>
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">Message your group</label>
          <Textarea id="chat-input" rows={1} className="min-h-11 flex-1 resize-none" value={text} maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Message your group… (Enter to send, Shift+Enter for a new line)" />
          <Button type="submit" size="icon" aria-label="Send message" pending={sending} disabled={!text.trim()}><Send /></Button>
        </div>
        <SpeechButton onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
      </form>
    </div>
  );
}

/** Discussion stage: shared ideas to build on, alongside the chat. */
export function Discussion() {
  const { group, act } = useWorkspace();
  const run = useRun();
  const [buildOn, setBuildOn] = useState<string | null>(null);
  const [text, setText] = useState("");
  const ideas = group.ideas.shared;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section aria-labelledby="shared-ideas" className="flex flex-col gap-2">
        <h2 id="shared-ideas" className="font-semibold">Your group&apos;s ideas</h2>
        {ideas.length === 0 ? <p className="text-sm text-ink-muted">No ideas were shared in writing. Talk it through, or add one below.</p> : (
          <ul className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto pr-1">
            {ideas.map((i) => {
              const parent = i.buildsOn ? ideas.find((x) => x.id === i.buildsOn) : null;
              return (
                <li key={i.id}>
                  <Card className={cn("p-3", buildOn === i.id && "border-teal")}>
                    {parent ? <p className="mb-1 flex gap-1 text-xs text-ink-muted"><CornerDownRight className="size-3 shrink-0" aria-hidden="true" />Builds on: {parent.body.slice(0, 80)}</p> : null}
                    <p>{i.body}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-ink-muted">{i.author}</span>
                      <Button size="sm" variant="ghost" onClick={() => { setBuildOn(i.id); document.getElementById("build-text")?.focus(); }}><PlusCircle />Build on this</Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        <form className="flex flex-col gap-2 rounded-2xl border border-dashed border-line-strong p-3" onSubmit={async (e) => {
          e.preventDefault();
          if (text.trim() && await run(() => act({ action: "idea_save", body: text, submit: true, buildsOn: buildOn }), "Added to your group's ideas")) { setText(""); setBuildOn(null); }
        }}>
          <label htmlFor="build-text" className="text-sm font-semibold">{buildOn ? "Build on that idea" : "Add an idea"}</label>
          {buildOn ? <p className="flex items-center gap-2 text-xs text-ink-muted">Building on: {ideas.find((x) => x.id === buildOn)?.body.slice(0, 80)} <button type="button" aria-label="Cancel" onClick={() => setBuildOn(null)}><X className="size-3.5" /></button></p> : null}
          <Textarea id="build-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
          <Button type="submit" size="sm" variant="secondary" className="self-end" disabled={!text.trim()}>Add</Button>
        </form>
      </section>
      <Chat className="h-[min(70dvh,40rem)]" />
    </div>
  );
}

export function ChatDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Group chat" description="Optional — talking in the room counts too.">
        <Chat className="h-full rounded-none border-0" />
      </SheetContent>
    </Dialog>
  );
}
