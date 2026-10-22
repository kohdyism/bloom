"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Save, X, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Input, Notice, Select, Textarea } from "@/components/ui/primitives";
import { AiOriginBadge } from "@/components/live/ai-badge";
import { Mascot } from "@/components/mascot";
import { useRun } from "@/components/ui/toast";
import type { SynthesisCluster } from "@/lib/ai/synthesis";
import { useWorkspace } from "./context";

/**
 * AI idea synthesis (spec §15): labelled as AI, every theme links back to the
 * original wording, and students can rename, regroup, add and challenge.
 */
export function Synthesis() {
  const { group, act } = useWorkspace();
  const run = useRun();
  const syn = group.synthesis;
  const ideas = useMemo(() => new Map(group.ideas.shared.map((i) => [i.id, i])), [group.ideas.shared]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SynthesisCluster[]>([]);
  const [note, setNote] = useState("");
  const [newIdea, setNewIdea] = useState("");

  if (!syn) {
    return (
      <Card className="flex items-center gap-4 p-6">
        <Mascot mood="thinking" size={64} />
        <div>
          <p className="font-semibold" role="status">Nova is grouping your ideas…</p>
          <p className="text-sm text-ink-muted">This only takes a moment. Your original ideas are kept exactly as you wrote them.</p>
        </div>
      </Card>
    );
  }

  const clustered = new Set(syn.clusters.flatMap((c) => c.ideaIds));
  const unclustered = group.ideas.shared.filter((i) => !clustered.has(i.id));
  const startEdit = () => {
    const base = structuredClone(syn.clusters);
    if (unclustered.length) base.push({ id: `new${base.length + 1}`, title: "New ideas", summary: "", ideaIds: unclustered.map((i) => i.id) });
    setDraft(base); setNote(""); setEditing(true);
  };
  const moveIdea = (ideaId: string, toCluster: string) =>
    setDraft((d) => d.map((c) => ({ ...c, ideaIds: c.id === toCluster ? [...c.ideaIds.filter((x) => x !== ideaId), ideaId] : c.ideaIds.filter((x) => x !== ideaId) })));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {syn.clusters.length ? <AiOriginBadge origin={syn.origin === "student_edit" ? syn.aiOrigin : syn.origin} edited={syn.origin === "student_edit"} /> : null}
        {syn.origin === "student_edit" && syn.editedBy ? <span className="text-sm text-ink-muted">Last changed by {syn.editedBy}{syn.note ? `: “${syn.note}”` : ""}</span> : null}
        <span className="ml-auto flex gap-2">
          {!editing ? <Button size="sm" variant="secondary" onClick={startEdit}><Pencil />Change the groups</Button> : null}
          <Button size="sm" variant="ghost" onClick={() => run(() => act({ action: "synthesis_refresh" }), "Asked Nova to try again")}><RefreshCw />Try another grouping</Button>
        </span>
      </div>
      <Notice>These themes are a suggestion, not the answer. If something doesn&apos;t fit, change it — and tell your group why.</Notice>

      {syn.clusters.length === 0 && !editing ? <Notice tone="amber">No ideas were shared, so there&apos;s nothing to group yet. You can add one below.</Notice> : null}

      {!editing ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {syn.clusters.map((c) => (
            <li key={c.id}>
              <Card className="h-full p-4">
                <h3 className="font-display text-lg font-semibold">{c.title}</h3>
                {c.summary ? <p className="text-sm text-ink-muted">{c.summary}</p> : null}
                <ul className="mt-3 flex flex-col gap-2" aria-label={`Ideas in ${c.title}`}>
                  {c.ideaIds.map((id) => {
                    const i = ideas.get(id);
                    if (!i) return null;
                    return (
                      <li key={id} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                        <Quote className="mr-1 inline size-3 align-[-1px] text-ink-faint" aria-hidden="true" />
                        <span className="sr-only">Original wording: </span>{i.body}
                        <span className="mt-0.5 block text-xs text-ink-muted">— {i.author}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
      {!editing && unclustered.length ? (
        <Card className="p-4">
          <h3 className="font-semibold">Added since the grouping</h3>
          <ul className="mt-2 flex flex-col gap-2">{unclustered.map((i) => <li key={i.id} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">{i.body}<span className="block text-xs text-ink-muted">— {i.author}</span></li>)}</ul>
          <p className="mt-2 text-xs text-ink-muted">Use “Change the groups” to place these into themes.</p>
        </Card>
      ) : null}
      {editing ? (
        <div className="flex flex-col gap-4">
          {draft.map((c, ci) => (
            <Card key={c.id} className="flex flex-col gap-2 p-4">
              <div className="flex gap-2">
                <label className="sr-only" htmlFor={`ct-${c.id}`}>Theme name</label>
                <Input id={`ct-${c.id}`} value={c.title} onChange={(e) => setDraft((d) => d.map((x, i) => (i === ci ? { ...x, title: e.target.value } : x)))} />
                <Button variant="ghost" size="icon" aria-label={`Remove theme ${c.title} (its ideas move to Different angles)`} onClick={() => setDraft((d) => d.filter((_, i) => i !== ci))}><X /></Button>
              </div>
              <ul className="flex flex-col gap-1.5">
                {c.ideaIds.map((id) => (
                  <li key={id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">{ideas.get(id)?.body}</span>
                    <label className="sr-only" htmlFor={`mv-${id}`}>Move idea to theme</label>
                    <Select id={`mv-${id}`} className="h-8 w-auto text-xs" value={c.id} onChange={(e) => moveIdea(id, e.target.value)}>
                      {draft.map((t) => <option key={t.id} value={t.id}>{t.title || "Untitled theme"}</option>)}
                    </Select>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <Button variant="ghost" className="self-start" onClick={() => setDraft((d) => [...d, { id: `new${d.length + 1}`, title: "New theme", summary: "", ideaIds: [] }])}><Plus />Add a theme</Button>
          <label htmlFor="syn-note" className="text-sm font-semibold">Why did you change it? <span className="font-normal text-ink-muted">(optional, shown to your group)</span></label>
          <Input id="syn-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={async () => { if (await run(() => act({ action: "synthesis_edit", clusters: draft, note }), "Saved for your group")) setEditing(false); }}><Save />Save changes</Button>
          </div>
        </div>
      ) : null}

      <form className="flex flex-col gap-2 rounded-2xl border border-dashed border-line-strong p-4" onSubmit={async (e) => {
        e.preventDefault();
        if (newIdea.trim() && await run(() => act({ action: "idea_save", body: newIdea, submit: true }), "Idea added to your group")) setNewIdea("");
      }}>
        <label htmlFor="new-idea" className="font-semibold">Thought of something new?</label>
        <Textarea id="new-idea" rows={2} value={newIdea} onChange={(e) => setNewIdea(e.target.value)} maxLength={1000} placeholder="New ideas now go straight to your group." />
        <Button type="submit" size="sm" variant="secondary" className="self-end" disabled={!newIdea.trim()}><Plus />Add idea</Button>
      </form>
    </div>
  );
}
