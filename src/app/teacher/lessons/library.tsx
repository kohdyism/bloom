"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronRight, Clock, Folder, FolderOpen, FolderPlus, Layers, Pencil, Search, Sparkles, Tag, Trash2, X } from "lucide-react";
import type { LessonFolder, LessonListItem } from "@/lib/modules/lessons";
import { Badge, Card, Input, Select } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, minutesLabel } from "@/lib/utils";
import { createFolderAction, deleteFolderAction, moveLessonAction, renameFolderAction } from "./actions";

type ClassRef = { id: string; name: string };
/** Where the teacher is in the library: the top, a class (or "no class" / templates), or a folder inside it. */
export type LibraryView = { place: "root" } | { place: "class"; classId: string | null } | { place: "templates" } | { place: "folder"; folderId: string };

const href = (v: LibraryView) =>
  v.place === "root" ? "/teacher/lessons"
    : v.place === "templates" ? "/teacher/lessons?in=templates"
    : v.place === "class" ? `/teacher/lessons?in=${v.classId ?? "none"}`
    : `/teacher/lessons?folder=${v.folderId}`;

/**
 * The lesson library, organised like projects: one folder per class at the
 * top, and inside each class the teacher's own folders (or none). Search and
 * tags look across every lesson.
 */
export function LessonLibrary({ lessons, classes, folders, view }: { lessons: LessonListItem[]; classes: ClassRef[]; folders: LessonFolder[]; view: LibraryView }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const className = (id: string | null) => (id ? classes.find((c) => c.id === id)?.name ?? "Class" : "No class yet");
  const folder = view.place === "folder" ? folders.find((f) => f.id === view.folderId) ?? null : null;

  // Lessons in the current place.
  const here = lessons.filter((l) => {
    if (view.place === "templates") return l.isTemplate;
    if (l.isTemplate) return false;
    if (view.place === "class") return l.classId === view.classId && !l.folderId;
    if (view.place === "folder") return l.folderId === view.folderId;
    return false;
  });
  const searching = !!needle || !!tag;
  const matches = (l: LessonListItem) =>
    (!tag || l.tags.some((t) => t.toLowerCase() === tag)) &&
    (!needle || [l.title, l.subject, l.yearLevel, l.className ?? "", ...l.tags].some((x) => x.toLowerCase().includes(needle)));
  const results = searching ? lessons.filter(matches) : [];

  const allTags = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const l of lessons) for (const t of l.tags) {
      const k = t.toLowerCase();
      counts.set(k, { label: counts.get(k)?.label ?? t, n: (counts.get(k)?.n ?? 0) + 1 });
    }
    return [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
  }, [lessons]);

  const crumbs: { label: string; to?: LibraryView }[] = [{ label: "All classes", to: { place: "root" } }];
  if (view.place === "class") crumbs.push({ label: className(view.classId) });
  if (view.place === "templates") crumbs.push({ label: "Saved templates" });
  if (view.place === "folder" && folder) crumbs.push({ label: className(folder.classId), to: { place: "class", classId: folder.classId } }, { label: folder.name });
  if (view.place === "root") crumbs.length = 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <label htmlFor="lesson-search" className="sr-only">Search lessons</label>
          <Input id="lesson-search" type="search" className="h-11 pl-10" placeholder="Search all lessons by title, subject, class or tag" value={q} onChange={(e) => setQ(e.target.value)} />
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
      </div>

      {searching ? (
        <section aria-label="Search results" className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted" aria-live="polite">{results.length} lesson{results.length === 1 ? "" : "s"} found across your library</p>
          {results.length ? <LessonGrid lessons={results} folders={folders} showPlace /> : <p className="rounded-2xl bg-white/70 p-6 text-center text-ink-muted">No lessons match. Try a different word or tag.</p>}
        </section>
      ) : (
        <>
          {crumbs.length ? (
            <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-sm">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i ? <ChevronRight className="size-4 text-ink-faint" aria-hidden="true" /> : null}
                  {c.to ? <Link href={href(c.to)} className="rounded-md px-1.5 py-0.5 font-semibold text-teal hover:bg-teal-soft">{c.label}</Link> : <span className="px-1.5 py-0.5 font-semibold" aria-current="page">{c.label}</span>}
                </span>
              ))}
            </nav>
          ) : null}
          {view.place === "root" ? <RootView lessons={lessons} classes={classes} folders={folders} /> : null}
          {view.place === "class" ? <ClassView classId={view.classId} lessons={here} folders={folders} allLessons={lessons} /> : null}
          {view.place === "templates" || view.place === "folder" ? (
            here.length ? <LessonGrid lessons={here} folders={folders} /> : <p className="rounded-2xl bg-white/70 p-6 text-center text-ink-muted">{view.place === "folder" ? "This folder is empty. Use “Move to folder” on a lesson to put it here." : "No saved templates yet."}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

function PlaceCard({ to, title, sub, icon: Icon, tone }: { to: LibraryView; title: string; sub: string; icon: React.ElementType; tone: string }) {
  return (
    <li>
      <Link href={href(to)} className="group block h-full rounded-2xl">
        <Card className="flex h-full items-center gap-4 p-4 transition-shadow group-hover:shadow-lift">
          <span className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-2xl", tone)}><Icon className="size-6" aria-hidden="true" /></span>
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-semibold">{title}</span>
            <span className="block text-sm text-ink-muted">{sub}</span>
          </span>
          <ChevronRight className="ml-auto size-5 shrink-0 text-ink-faint" aria-hidden="true" />
        </Card>
      </Link>
    </li>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function RootView({ lessons, classes, folders }: { lessons: LessonListItem[]; classes: ClassRef[]; folders: LessonFolder[] }) {
  const regular = lessons.filter((l) => !l.isTemplate);
  const unassigned = regular.filter((l) => !l.classId);
  const templates = lessons.filter((l) => l.isTemplate);
  return (
    <section aria-labelledby="classes-h" className="flex flex-col gap-3">
      <h2 id="classes-h" className="font-display text-lg font-semibold">Classes</h2>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => {
          const n = regular.filter((l) => l.classId === c.id).length;
          const f = folders.filter((x) => x.classId === c.id).length;
          return <PlaceCard key={c.id} to={{ place: "class", classId: c.id }} title={c.name} sub={`${plural(n, "lesson")}${f ? ` · ${plural(f, "folder")}` : ""}`} icon={Folder} tone="bg-teal-soft text-teal-strong" />;
        })}
        {unassigned.length || folders.some((x) => !x.classId) ? <PlaceCard to={{ place: "class", classId: null }} title="No class yet" sub={plural(unassigned.length, "lesson")} icon={Folder} tone="bg-surface-2 text-ink-muted" /> : null}
        {templates.length ? <PlaceCard to={{ place: "templates" }} title="Saved templates" sub={plural(templates.length, "template")} icon={Bookmark} tone="bg-purple-soft text-purple" /> : null}
      </ul>
      {regular.length ? (
        <>
          <h2 className="mt-4 font-display text-lg font-semibold">Recent lessons</h2>
          <LessonGrid lessons={[...regular].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)} folders={folders} showPlace />
        </>
      ) : null}
    </section>
  );
}

function ClassView({ classId, lessons, folders, allLessons }: { classId: string | null; lessons: LessonListItem[]; folders: LessonFolder[]; allLessons: LessonListItem[] }) {
  const mine = folders.filter((f) => f.classId === classId);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const create = () => start(async () => {
    const res = await createFolderAction(classId, name);
    if (res.error) toast({ title: "That didn't work", body: res.error, tone: "coral" });
    else { setName(""); setAdding(false); router.refresh(); }
  });
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="folders-h" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="folders-h" className="font-display text-lg font-semibold">Folders</h2>
          {!adding ? <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setAdding(true)}><FolderPlus />New folder</Button> : null}
        </div>
        {adding ? (
          <form className="flex max-w-lg gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create(); }}>
            <Input aria-label="Folder name" autoFocus className="h-10" placeholder="e.g. Poetry unit, Term 1" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <Button type="submit" size="sm" className="h-10" pending={pending} disabled={!name.trim()}>Create</Button>
            <Button type="button" size="sm" variant="ghost" className="h-10" onClick={() => { setAdding(false); setName(""); }}>Cancel</Button>
          </form>
        ) : null}
        {mine.length ? (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mine.map((f) => <FolderCard key={f.id} folder={f} count={allLessons.filter((l) => l.folderId === f.id).length} />)}
          </ul>
        ) : !adding ? <p className="text-sm text-ink-muted">No folders yet. Folders are optional — lessons can stay loose in the class.</p> : null}
      </section>
      <section aria-labelledby="loose-h" className="flex flex-col gap-3">
        <h2 id="loose-h" className="font-display text-lg font-semibold">{mine.length ? "Not in a folder" : "Lessons"}</h2>
        {lessons.length ? <LessonGrid lessons={lessons} folders={folders} /> : <p className="text-sm text-ink-muted">{mine.length ? "Every lesson in this class is in a folder." : "No lessons in this class yet."}</p>}
      </section>
    </div>
  );
}

function FolderCard({ folder, count }: { folder: LessonFolder; count: number }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const done = (res: { error?: string }) => { if (res.error) toast({ title: "That didn't work", body: res.error, tone: "coral" }); else { setEditing(false); router.refresh(); } };
  if (editing) {
    return (
      <li>
        <Card className="flex items-center gap-2 p-3">
          <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => done(await renameFolderAction(folder.id, name))); }}>
            <Input aria-label="Folder name" autoFocus className="h-10" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <Button type="submit" size="sm" className="h-10" pending={pending} disabled={!name.trim()}>Save</Button>
          </form>
          <Button type="button" size="sm" variant="ghost" className="h-10" onClick={() => { setEditing(false); setName(folder.name); }}>Cancel</Button>
        </Card>
      </li>
    );
  }
  return (
    <li className="relative">
      <Link href={href({ place: "folder", folderId: folder.id })} className="group block h-full rounded-2xl">
        <Card className="flex h-full items-center gap-4 p-4 pr-24 transition-shadow group-hover:shadow-lift">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sun-soft text-amber"><FolderOpen className="size-6" aria-hidden="true" /></span>
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-semibold">{folder.name}</span>
            <span className="block text-sm text-ink-muted">{plural(count, "lesson")}</span>
          </span>
        </Card>
      </Link>
      <span className="absolute right-3 top-1/2 flex -translate-y-1/2 gap-1">
        <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label={`Rename folder ${folder.name}`} onClick={() => setEditing(true)}><Pencil className="size-4" /></button>
        <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-coral-soft hover:text-coral" aria-label={`Delete folder ${folder.name}`}
          onClick={() => { if (window.confirm(`Delete the folder “${folder.name}”? Its lessons stay in the class.`)) start(async () => done(await deleteFolderAction(folder.id))); }}><Trash2 className="size-4" /></button>
      </span>
    </li>
  );
}

function LessonGrid({ lessons, folders, showPlace = false }: { lessons: LessonListItem[]; folders: LessonFolder[]; showPlace?: boolean }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {lessons.map((l) => <LessonCard key={l.id} l={l} folders={folders} showPlace={showPlace} />)}
    </ul>
  );
}

function LessonCard({ l, folders, showPlace }: { l: LessonListItem; folders: LessonFolder[]; showPlace: boolean }) {
  const options = folders.filter((f) => f.classId === l.classId);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const folderName = folders.find((f) => f.id === l.folderId)?.name;
  return (
    <li>
      <Card className="flex h-full flex-col transition-shadow hover:shadow-lift">
        <Link href={`/teacher/lessons/${l.id}`} className="flex flex-1 flex-col rounded-t-2xl p-5 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {l.isTemplate ? <Badge tone="purple"><Bookmark aria-hidden="true" />Template</Badge> : l.className ? <Badge tone="teal">{l.className}</Badge> : <Badge>No class</Badge>}
            {showPlace && folderName ? <Badge><Folder aria-hidden="true" />{folderName}</Badge> : null}
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
        </Link>
        {!l.isTemplate && options.length ? (
          <div className="flex items-center gap-2 border-t border-line px-5 py-2.5">
            <label htmlFor={`move-${l.id}`} className="shrink-0 text-sm text-ink-muted"><Folder className="mr-1 inline size-4" aria-hidden="true" />Move to folder</label>
            <Select id={`move-${l.id}`} className="h-9 min-w-0 flex-1 text-sm" disabled={pending} value={l.folderId ?? ""}
              onChange={(e) => { const v = e.target.value || null; start(async () => { const res = await moveLessonAction(l.id, v); if (res.error) toast({ title: "That didn't work", body: res.error, tone: "coral" }); else router.refresh(); }); }}>
              <option value="">Not in a folder</option>
              {options.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
        ) : null}
      </Card>
    </li>
  );
}
