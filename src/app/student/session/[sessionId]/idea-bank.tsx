"use client";

import { useMemo, useState } from "react";
import { Check, Copy, CornerDownRight, Lock, Pencil, Plus, PlusCircle, Trash2, X } from "lucide-react";
import { Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useRun, useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";

type SharedIdea = ReturnType<typeof useWorkspace>["group"]["ideas"]["shared"][number];

const THEME_TINTS = ["bg-sun-soft", "bg-teal-soft", "bg-purple-soft", "bg-coral-soft", "bg-blue-soft", "bg-mint-soft"];

/**
 * The group's ideas, one tap away — so what you thought of earlier is right
 * there when you're writing, voting or presenting. During private thinking
 * time it shows only your own ideas.
 */
export function IdeaBank() {
  const { group } = useWorkspace();
  const brainstorming = group.stage?.kind === "brainstorm" && group.stageStatus !== "complete";
  return <div className="flex min-h-0 flex-1 flex-col">{brainstorming ? <MyPrivateIdeas /> : <SharedIdeas />}</div>;
}

/**
 * Discussion: a calm reference list of the ideas you wrote earlier, so you can
 * talk about them face to face. No AI buttons and no editing here.
 */
export function MyEarlierIdeas() {
  const { group } = useWorkspace();
  const mine = group.ideas.mine.filter((i) => i.status === "submitted");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <p className="rounded-2xl bg-sun-soft px-4 py-3 font-semibold">Talk it through with your group, face to face. Your ideas from earlier are here if you want a reminder.</p>
      <h3 className="font-display text-lg font-bold">Your ideas from earlier</h3>
      {mine.length === 0 ? <p className="px-1 py-4 text-ink-muted">You didn&apos;t write any ideas earlier. That&apos;s fine — listen, then add your thoughts out loud.</p> : (
        <ul className="flex flex-col gap-2" aria-label="Your ideas from earlier">
          {mine.map((i) => <li key={i.id} className="whitespace-pre-line rounded-2xl border border-line bg-white p-3 text-[1.05rem] shadow-soft">{i.body}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Your own ideas during thinking time. `inline` = listed under the idea box. */
export function MyPrivateIdeas({ inline = false }: { inline?: boolean }) {
  const { group, act, requestEdit } = useWorkspace();
  const run = useRun();
  const mine = group.ideas.mine;
  if (inline && mine.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-2", inline ? "pt-1" : "min-h-0 flex-1 overflow-y-auto p-3")}>
      {inline ? <p className="font-display text-base font-semibold">Your ideas so far</p> : <p className="flex items-start gap-2 rounded-2xl bg-teal-soft px-3 py-2 text-sm"><Lock className="mt-0.5 size-4 shrink-0 text-teal-strong" aria-hidden="true" />Only you can see these until thinking time ends.</p>}
      {mine.length === 0 ? <p className="px-1 py-6 text-center text-sm text-ink-muted">Your ideas will appear here as you add them.</p> : (
        <ul className="flex flex-col gap-2" aria-label="Ideas you've added">
          {mine.map((i) => (
            <li key={i.id} className="group rounded-2xl border border-line bg-white p-3 shadow-soft">
              <p className="whitespace-pre-line">{i.body}</p>
              <div className="mt-2 flex items-center gap-1">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", i.shared ? "bg-teal-soft text-teal-strong" : i.status === "submitted" ? "bg-mint-soft text-mint" : "bg-surface-2 text-ink-muted")}>
                  {i.shared ? "Shared with group" : i.status === "submitted" ? <><Check className="mr-0.5 inline size-3" aria-hidden="true" />Added — private until thinking time ends</> : "Draft"}
                </span>
                {!i.shared ? (
                  <span className="ml-auto flex">
                    <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Edit idea" onClick={() => requestEdit(i.id, i.body)}><Pencil className="size-4" /></button>
                    <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-coral-soft hover:text-coral" aria-label="Delete idea" onClick={() => run(() => act({ action: "idea_delete", id: i.id }))}><Trash2 className="size-4" /></button>
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SharedIdeas() {
  const { group, act, inserter } = useWorkspace();
  const run = useRun();
  const [text, setText] = useState("");
  const [buildOn, setBuildOn] = useState<string | null>(null);
  const ideas = group.ideas.shared;
  const byId = useMemo(() => new Map(ideas.map((i) => [i.id, i])), [ideas]);

  // Group by the (AI or student-edited) themes when there are any.
  const sections = useMemo(() => {
    const clusters = group.synthesis?.clusters ?? [];
    if (!clusters.length) return [{ id: "all", title: null as string | null, items: ideas }];
    const placed = new Set<string>();
    const out = clusters.map((c) => {
      const items = c.ideaIds.map((id) => byId.get(id)).filter((x): x is SharedIdea => !!x);
      items.forEach((i) => placed.add(i.id));
      return { id: c.id, title: c.title as string | null, items };
    }).filter((s) => s.items.length);
    const rest = ideas.filter((i) => !placed.has(i.id));
    if (rest.length) out.push({ id: "rest", title: "Newer ideas", items: rest });
    return out;
  }, [group.synthesis, ideas, byId]);

  const canAdd = group.stage?.kind !== "brainstorm";
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {inserter ? <p className="rounded-2xl bg-mint-soft px-3 py-2 text-sm">Press <strong>Add</strong> to put an idea into your {inserter.label}.</p> : null}
        {ideas.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-ink-muted">No ideas were shared in writing yet. Add one below — or talk it through in the room.</p>
        ) : sections.map((s, si) => (
          <div key={s.id} className="flex flex-col gap-2">
            {s.title ? <h3 className={cn("rounded-xl px-2.5 py-1 font-display text-sm font-bold", THEME_TINTS[si % THEME_TINTS.length])}>{s.title}</h3> : null}
            <ul className="flex flex-col gap-2" aria-label={s.title ? `Ideas in ${s.title}` : "Your group's ideas"}>
              {s.items.map((i) => (
                <IdeaCard key={i.id} idea={i} parent={i.buildsOn ? byId.get(i.buildsOn) : undefined} votes={group.votes.tally[i.id] ?? 0}
                  onBuild={canAdd ? () => { setBuildOn(i.id); document.getElementById("bank-new-idea")?.focus(); } : undefined} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      {canAdd ? (
        <form className="flex flex-col gap-2 border-t border-line bg-white p-3" onSubmit={async (e) => {
          e.preventDefault();
          if (text.trim() && await run(() => act({ action: "idea_save", body: text, submit: true, buildsOn: buildOn }), "Added to your group's ideas")) { setText(""); setBuildOn(null); }
        }}>
          <label htmlFor="bank-new-idea" className="text-sm font-semibold">{buildOn ? "Build on that idea" : "Add a new idea"}</label>
          {buildOn ? <p className="flex items-center gap-2 text-xs text-ink-muted"><CornerDownRight className="size-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{byId.get(buildOn)?.body}</span><button type="button" aria-label="Stop building on this idea" onClick={() => setBuildOn(null)}><X className="size-3.5" /></button></p> : null}
          <div className="flex items-end gap-2">
            <Textarea id="bank-new-idea" rows={1} className="min-h-11 flex-1 resize-none bg-white" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Goes straight to your group" />
            <Button type="submit" size="icon" aria-label="Add to idea bank" disabled={!text.trim()}><Plus /></Button>
          </div>
        </form>
      ) : null}
    </>
  );
}

function IdeaCard({ idea, parent, votes, onBuild }: { idea: SharedIdea; parent?: SharedIdea; votes: number; onBuild?: () => void }) {
  const { inserter } = useWorkspace();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(idea.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Couldn't copy", body: "Select the text and copy it instead.", tone: "amber" });
    }
  };
  return (
    <li className="group rounded-2xl border border-line bg-white p-3 shadow-soft transition hover:border-purple/40 hover:shadow-lift">
      {parent ? <p className="mb-1 flex gap-1 text-xs text-ink-muted"><CornerDownRight className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">Builds on: {parent.body}</span></p> : null}
      <p className="whitespace-pre-line text-[0.97rem] leading-snug">{idea.body}</p>
      <div className="mt-2 flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">— {idea.author}{votes ? ` · ${votes} vote${votes === 1 ? "" : "s"}` : ""}</span>
        <button type="button" onClick={copy} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label={`Copy idea: ${idea.body.slice(0, 60)}`}>
          {copied ? <Check className="size-4 text-mint" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}<span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
        {onBuild && !inserter ? (
          <button type="button" onClick={onBuild} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label={`Build on idea: ${idea.body.slice(0, 60)}`}><CornerDownRight className="size-4" aria-hidden="true" />Build</button>
        ) : null}
        {inserter ? (
          <button type="button" onClick={() => { inserter.insert(idea.body); toast({ title: `Added to your ${inserter.label}`, tone: "teal" }); }} className="inline-flex h-8 items-center gap-1 rounded-lg bg-mint-soft px-2 text-xs font-semibold text-mint hover:brightness-95" aria-label={`Add to ${inserter.label}: ${idea.body.slice(0, 60)}`}>
            <PlusCircle className="size-4" aria-hidden="true" />Add
          </button>
        ) : null}
      </div>
    </li>
  );
}
