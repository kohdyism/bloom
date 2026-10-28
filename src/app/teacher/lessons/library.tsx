"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Clock, Layers, Search, Sparkles, Tag, X } from "lucide-react";
import type { LessonListItem } from "@/lib/modules/lessons";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { cn, minutesLabel } from "@/lib/utils";

/** The lesson library with a search box and tag filters (tags are set in each lesson's settings). */
export function LessonLibrary({ lessons }: { lessons: LessonListItem[] }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const allTags = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const l of lessons) for (const t of l.tags) {
      const k = t.toLowerCase();
      counts.set(k, { label: counts.get(k)?.label ?? t, n: (counts.get(k)?.n ?? 0) + 1 });
    }
    return [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
  }, [lessons]);
  const needle = q.trim().toLowerCase();
  const shown = lessons.filter((l) => {
    if (tag && !l.tags.some((t) => t.toLowerCase() === tag)) return false;
    if (!needle) return true;
    return [l.title, l.subject, l.yearLevel, l.className ?? "", ...l.tags].some((x) => x.toLowerCase().includes(needle));
  });
  const regular = shown.filter((l) => !l.isTemplate);
  const templates = shown.filter((l) => l.isTemplate);
  const filtering = !!needle || !!tag;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <label htmlFor="lesson-search" className="sr-only">Search lessons</label>
          <Input id="lesson-search" type="search" className="h-11 pl-10" placeholder="Search by title, subject, class or tag" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {allTags.length ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by tag">
            <Tag className="size-4 text-ink-muted" aria-hidden="true" />
            {allTags.map(([k, v]) => (
              <button key={k} type="button" aria-pressed={tag === k} onClick={() => setTag(tag === k ? null : k)}
                className={cn("rounded-full px-3 py-1 text-sm font-medium", tag === k ? "bg-teal text-white" : "bg-teal-soft text-teal-strong hover:bg-teal/20")}>
                {v.label} <span className="opacity-70">{v.n}</span>
              </button>
            ))}
            {tag ? <button type="button" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-ink-muted hover:text-ink" onClick={() => setTag(null)}><X className="size-3.5" aria-hidden="true" />Clear</button> : null}
          </div>
        ) : null}
        {filtering ? <p className="text-sm text-ink-muted" aria-live="polite">{shown.length} lesson{shown.length === 1 ? "" : "s"} found</p> : null}
      </div>
      {regular.length ? <LessonGrid lessons={regular} /> : filtering ? <p className="rounded-2xl bg-white/70 p-6 text-center text-ink-muted">No lessons match. Try a different word or tag.</p> : null}
      {templates.length ? (
        <section className="mt-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><Bookmark className="size-5 text-purple" aria-hidden="true" />Your saved templates</h2>
          <LessonGrid lessons={templates} />
        </section>
      ) : null}
    </div>
  );
}

function LessonGrid({ lessons }: { lessons: LessonListItem[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {lessons.map((l) => (
        <li key={l.id}>
          <Link href={`/teacher/lessons/${l.id}`} className="group block h-full rounded-2xl">
            <Card className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-lift">
              <div className="flex flex-wrap gap-1.5">
                {l.className ? <Badge tone="teal">{l.className}</Badge> : <Badge>No class</Badge>}
                {l.needsApproval ? <Badge tone="amber"><Sparkles aria-hidden="true" />AI draft — needs review</Badge> : null}
                {l.source === "ai" && !l.needsApproval ? <Badge tone="purple"><Sparkles aria-hidden="true" />AI-assisted</Badge> : null}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold">{l.title}</h3>
              <p className="text-sm text-ink-muted">{[l.yearLevel, l.subject].filter(Boolean).join(" · ")}</p>
              {l.tags.length ? <ul className="mt-2 flex flex-wrap gap-1" aria-label="Tags">{l.tags.map((t) => <li key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-muted">{t}</li>)}</ul> : null}
              <div className="mt-auto flex gap-4 pt-4 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-1.5"><Layers className="size-4" aria-hidden="true" />{l.stageCount} stages</span>
                <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden="true" />{minutesLabel(l.totalSeconds)}</span>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
