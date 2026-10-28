"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Flag, ShieldAlert } from "lucide-react";
import type { TeacherState } from "@/lib/modules/sessions/state";
import { FLAG_LABELS } from "@/lib/domain/moderation";
import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { TeacherAction } from "./live-session";

type FlagRow = TeacherState["flags"][number];
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");

/**
 * Moderation flags from the group chat and Pip. Safeguarding concerns sit on
 * top in a red banner that can't be missed; everything else is a quiet list.
 * The flagged words stay hidden until the teacher chooses to look.
 */
export function FlagsPanel({ state, names, groupName, act }: { state: TeacherState; names: Map<string, string>; groupName: (id: string | null) => string; act: (b: TeacherAction) => Promise<void> }) {
  const run = useRun();
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [showReviewed, setShowReviewed] = useState(false);
  const urgent = state.flags.filter((f) => f.category === "safeguarding" && !f.reviewed);
  const others = state.flags.filter((f) => f.category !== "safeguarding" || f.reviewed);
  const openOthers = others.filter((f) => !f.reviewed);
  const list = showReviewed ? others : openOthers;
  const toggle = (id: string) => setShown((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const review = (f: FlagRow) => run(() => act({ action: "review_flag", flagId: f.id }), "Marked as reviewed");

  const row = (f: FlagRow, strong = false) => (
    <li key={f.id} className={cn("flex flex-col gap-2 rounded-xl border px-3 py-2.5", strong ? "border-coral bg-white" : "border-line", f.reviewed && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{names.get(f.studentId) ?? "A student"}</span>
        <span className="text-ink-muted">{groupName(f.groupId)}</span>
        <Badge tone={f.category === "safeguarding" ? "coral" : f.category === "inappropriate" || f.category === "unkind" ? "amber" : "neutral"}>{FLAG_LABELS[f.category]}</Badge>
        <Badge tone={f.source === "pip" ? "purple" : f.source === "idea" ? "blue" : "teal"}>{f.source === "pip" ? "Pip (private)" : f.source === "idea" ? "Idea" : "Group chat"}</Badge>
        <span className="text-ink-muted">{time(f.createdAt)}</span>
        {f.reviewed ? <Badge tone="mint"><Check aria-hidden="true" />Reviewed</Badge> : null}
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => toggle(f.id)} aria-expanded={shown.has(f.id)}>{shown.has(f.id) ? <><EyeOff />Hide message</> : <><Eye />Show message</>}</Button>
          {!f.reviewed ? <Button size="sm" variant={strong ? "primary" : "secondary"} onClick={() => review(f)}><Check />Mark reviewed</Button> : null}
        </span>
      </div>
      {shown.has(f.id) ? <p className="whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-sm">{f.excerpt || "(no text)"}</p> : null}
    </li>
  );

  if (!state.flags.length) return null;
  return (
    <div className="flex flex-col gap-4">
      {urgent.length ? (
        <section role="alert" aria-labelledby="sg-title" className="rounded-2xl border-4 border-coral bg-coral-soft p-4 shadow-lift">
          <h2 id="sg-title" className="flex items-center gap-2 font-display text-xl font-bold text-coral">
            <ShieldAlert className="size-7" aria-hidden="true" />Safeguarding concern{urgent.length > 1 ? `s (${urgent.length})` : ""}
          </h2>
          <p className="mt-1 text-sm">Words that may mean a student is at risk. Check in with them now and follow your school&apos;s safeguarding procedure. The student was shown a supportive message pointing to you and “Need help”.</p>
          <ul className="mt-3 flex flex-col gap-2">{urgent.map((f) => row(f, true))}</ul>
        </section>
      ) : null}
      {others.length ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2"><Flag className="size-5 text-amber" aria-hidden="true" />Flags {openOthers.length ? <Badge tone="amber">{openOthers.length} to review</Badge> : null}</CardTitle>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4 accent-[var(--teal)]" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} />Show reviewed</label>
          </CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-ink-muted">Messages and ideas Bloom held back before the group saw them, and questions Pip wouldn&apos;t answer. Students were told why at the time.</p>
            {list.length ? <ul className="flex flex-col gap-2">{list.map((f) => row(f))}</ul> : <p className="text-sm text-ink-muted">Nothing new to review.</p>}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
