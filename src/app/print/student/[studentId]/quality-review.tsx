"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice, Select, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { confirmReviewAction, suggestReviewAction } from "./actions";

const LEVELS = ["Emerging", "Developing", "Secure", "Strong"];
type Review = { criteria: { key: string; label: string; level: number | null; reason: string }[]; summary: string; evidence: string[]; origin: string; confirmed: boolean; note: string };

const ORIGIN = { ai: "AI suggestion", ai_simulated: "Simulated AI suggestion", offline_helper: "Offline helper suggestion" } as Record<string, string>;

/**
 * Quality of the student's written work in one lesson: an AI suggestion the
 * teacher checks, adjusts and confirms. Only confirmed ratings print.
 */
export function QualityReview({ sessionId, studentId, review }: { sessionId: string; studentId: string; review: Review | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [levels, setLevels] = useState<Record<string, number | null>>(() => Object.fromEntries((review?.criteria ?? []).map((c) => [c.key, c.level])));
  const [note, setNote] = useState(review?.note ?? "");

  const suggest = () => start(async () => { setError(null); const r = await suggestReviewAction(sessionId, studentId); if (r.error) setError(r.error); else { setEditing(true); router.refresh(); } });
  const confirm = () => start(async () => { setError(null); const r = await confirmReviewAction(sessionId, studentId, levels, note); if (r.error) setError(r.error); else { setEditing(false); router.refresh(); } });
  // Keep the form in step with a fresh suggestion from the server.
  const key = JSON.stringify(review?.criteria ?? []);
  const [seen, setSeen] = useState(key);
  if (key !== seen) { setSeen(key); setLevels(Object.fromEntries((review?.criteria ?? []).map((c) => [c.key, c.level]))); setNote(review?.note ?? ""); }

  if (!review) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 print:hidden">
        <p className="flex-1 text-sm text-ink-muted">Quality of written work: not rated yet.</p>
        <Button size="sm" variant="secondary" pending={pending} onClick={suggest}><Sparkles />Suggest a rating (AI)</Button>
        {error ? <Notice tone="coral" className="w-full">{error}</Notice> : null}
      </div>
    );
  }

  const showForm = !review.confirmed || editing;
  return (
    <div className={cn("mt-3 rounded-xl border p-3", showForm ? "border-purple/40 bg-purple-soft/30 print:hidden" : "border-line")}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">Quality of written work</p>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", review.confirmed && !editing ? "bg-mint-soft text-mint" : "bg-purple-soft text-purple")}>
          {review.confirmed && !editing ? "Checked by teacher" : `${ORIGIN[review.origin] ?? "AI suggestion"} — check before it goes on the report`}
        </span>
        {review.confirmed && !editing ? <Button size="sm" variant="ghost" className="ml-auto print:hidden" onClick={() => setEditing(true)}><Pencil />Change</Button> : null}
      </div>
      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
        {review.criteria.map((c) => (
          <li key={c.key} className="rounded-lg bg-white/80 p-2 text-sm">
            <p className="font-semibold">{c.label}</p>
            {showForm ? (
              <Select aria-label={`${c.label} level`} className="mt-1 h-9 text-sm" value={levels[c.key] ?? ""} onChange={(e) => setLevels({ ...levels, [c.key]: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Not enough written evidence</option>
                {LEVELS.map((l, i) => <option key={l} value={i + 1}>{i + 1} · {l}</option>)}
              </Select>
            ) : <p className="font-display text-lg font-bold">{c.level ? `${c.level} · ${LEVELS[c.level - 1]}` : "Not rated"}</p>}
            <p className="mt-1 text-ink-muted">{c.reason}</p>
          </li>
        ))}
      </ul>
      {review.summary ? <p className="mt-2 text-sm">{review.summary}</p> : null}
      {review.evidence.length ? <p className="mt-1 text-sm text-ink-muted">From their writing: {review.evidence.map((q) => `“${q}”`).join(" · ")}</p> : null}
      {showForm ? (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor={`note-${sessionId}`} className="text-sm font-semibold">Your note (printed with the rating, optional)</label>
          <Textarea id={`note-${sessionId}`} rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Contributed lots out loud in the discussion." />
          <p className="text-xs text-ink-muted">Only written work is rated. Spoken contributions and support needs aren&apos;t seen by the AI, so check the levels against what you saw.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" pending={pending} onClick={confirm}><Check />Confirm for the report</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={suggest}><RefreshCw />Suggest again</Button>
            {editing && review.confirmed ? <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button> : null}
          </div>
        </div>
      ) : review.note ? <p className="mt-2 text-sm"><span className="font-semibold">Teacher&apos;s note:</span> {review.note}</p> : null}
      {error ? <Notice tone="coral" className="mt-2">{error}</Notice> : null}
    </div>
  );
}
