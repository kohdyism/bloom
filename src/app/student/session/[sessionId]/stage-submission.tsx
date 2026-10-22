"use client";

import { useState } from "react";
import { Check, Send, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Notice, Textarea } from "@/components/ui/primitives";
import { useRun } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";
import { Creation } from "./stage-creation";
import { MediaUploader } from "./media";

const STEPS = ["Draft", "Submitting", "Submitted", "Teacher reviewed"] as const;

/** Group submission (spec §19): one member submits; everyone sees the status. */
export function Submission() {
  const { group, state, act } = useWorkspace();
  const run = useRun();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const latest = group.submissions[0] ?? null;
  const returned = latest?.status === "returned";
  const step = submitting ? 1 : !latest ? 0 : latest.status === "reviewed" ? 3 : 2;
  const blocked = !!latest && !state.session.allowResubmission && !returned;
  const hasWork = group.artifacts.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap items-center gap-2" aria-label="Submission status">
        {STEPS.map((label, i) => {
          const current = i === step;
          const done = i < step;
          const text = i === 3 && returned ? "Returned for revision" : label;
          return (
            <li key={label} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", done ? "bg-mint-soft text-mint" : current ? (returned && i === 3 ? "bg-amber-soft text-amber" : "bg-teal text-white") : "bg-surface-2 text-ink-muted")}>
                {done ? <Check className="size-3.5" aria-hidden="true" /> : null}{text}
              </span>
              {i < STEPS.length - 1 ? <span className="h-px w-4 bg-line-strong" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
      {returned ? <Notice tone="amber" title="Your teacher returned your work for revision">{latest.feedback || "Make your changes, then submit again."}</Notice> : null}
      {latest?.status === "reviewed" && latest.feedback ? <Notice tone="teal" title="Teacher feedback">{latest.feedback}</Notice> : null}
      {latest ? (
        <p className="text-sm text-ink-muted" aria-live="polite">Version {latest.version} submitted by {latest.submittedBy} at {new Date(latest.createdAt!).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}{latest.kinds.length ? ` · includes ${latest.kinds.join(", ")}` : ""}.</p>
      ) : <p className="text-sm text-ink-muted">Check your work together. When everyone&apos;s happy, one person submits it for the whole group.</p>}

      {hasWork ? (
        <details className="rounded-2xl border border-line bg-surface p-4" open={!latest || returned}>
          <summary className="cursor-pointer font-semibold">Your shared work {latest && !returned ? "(you can still edit it)" : "— last changes"}</summary>
          <div className="mt-3"><Creation /></div>
        </details>
      ) : null}
      {group.stage?.config.evidenceUpload && !hasWork ? <MediaUploader title="Photo evidence" /> : null}

      <form className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4" onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const ok = await run(() => act({ action: "submit", note, expectedVersion: latest?.version ?? 0 }), "Submitted for your group");
        if (ok) setNote("");
        setSubmitting(false);
      }}>
        <label htmlFor="sub-note" className="font-semibold">Note or results <span className="font-normal text-ink-muted">(optional)</span></label>
        <Textarea id="sub-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="e.g. Our three distances: 3.1 m, 4.2 m, 3.8 m" />
        {blocked ? <Notice>Your teacher has turned off resubmission for this lesson. Ask them if you need to change something.</Notice> : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {latest && group.presentationRequest !== "pending" && state.session.stages.some((s) => s.kind === "presentation") ? (
            <Button type="button" variant="ghost" onClick={() => run(() => act({ action: "request_present" }), "Request sent to your teacher")}><Trophy />Ask to present</Button>
          ) : group.presentationRequest === "pending" ? <Badge tone="blue">Asked to present</Badge> : null}
          <Button type="submit" pending={submitting} disabled={blocked}><Send />{latest ? "Submit an updated version" : "Submit for my group"}</Button>
        </div>
      </form>
    </div>
  );
}
