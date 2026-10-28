"use client";

import { useState } from "react";
import { ChevronDown, Ear, Hand, Repeat2 } from "lucide-react";
import { Buddy } from "@/components/buddy";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { useWorkspace } from "./context";
import { ReadAloudButton } from "@/components/read-aloud";
import { BigTimer } from "@/components/live/big-timer";
import { LifeBuoy } from "lucide-react";
import { HelpPanel } from "./help-panel";
import { MoreMenu } from "./session-header";
import { Readiness } from "./readiness";
import { MyEarlierIdeas } from "./idea-bank";

/**
 * Talk time: the screen steps back. A calm, nearly blank page with one big
 * message, Bloom at the top telling the group to talk face to face, and the
 * question to talk about. The group's ideas are tucked away in case anyone
 * wants a reminder.
 */
export function TalkTime() {
  const { group, state, sessionId, act } = useWorkspace();
  const [peek, setPeek] = useState(false);
  const small = !useMediaQuery("(min-width: 640px)");
  // A face-to-face Discussion shows only your OWN earlier ideas; talk time shows the group's.
  const ownOnly = group.stage?.kind === "discussion";
  const ideas = group.ideas.shared;
  const hasIdeas = ownOnly ? group.ideas.mine.some((i) => i.status === "submitted") : ideas.length > 0;
  return (
    <section aria-labelledby="talk-title" className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-gradient-to-b from-[#fff3e6] via-[#ffeef6] to-[#efe9ff] px-5 py-6 text-center sm:py-12">
      {/* No top bar or dock here: just a small timer and help in the corner. */}
      <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
        {group.stage ? <BigTimer timer={group.timer} totalSeconds={group.stage.durationSeconds} compact /> : <span />}
        <span className="flex items-center gap-1.5" data-tour="help">
          <HelpPanel state={state} sessionId={sessionId} act={act} trigger={
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-coral px-3 font-semibold text-white shadow-soft hover:brightness-95"><LifeBuoy className="size-5" aria-hidden="true" /><span className="max-sm:hidden">Need help</span><span className="sm:hidden">Help</span></button>
          } />
          <MoreMenu state={state} act={act} className="bg-white/80" />
        </span>
      </div>
      <div className="mt-10 flex flex-col items-center gap-3 sm:mt-4">
        <Buddy who="bloom" size={small ? 76 : 120} mood="happy" name="Bloom" />
        <p className="relative max-w-md rounded-3xl border-2 border-white bg-white px-4 py-2.5 font-display text-base font-semibold shadow-soft sm:px-5 sm:py-3 sm:text-xl">
          <span className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-white bg-white" aria-hidden="true" />
          Screens down! Turn to your group and talk face to face.
        </p>
      </div>
      <h1 id="talk-title" className="mt-6 font-display text-5xl sm:mt-8 font-bold leading-none tracking-tight text-ink sm:text-7xl">
        Discussion time!
      </h1>
      {group.stage?.instructions ? (
        <p className="mt-5 max-w-2xl font-display text-xl font-semibold leading-snug text-ink/85 sm:mt-6 sm:text-3xl">{group.stage.instructions}<ReadAloudButton text={group.stage.instructions} label="Read the question aloud" size="md" className="ml-2 align-middle" /></p>
      ) : null}
      <ul className="mt-8 flex flex-wrap justify-center gap-2 text-sm font-semibold text-ink-muted sm:text-base" aria-label="Tips">
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5"><Repeat2 className="size-4 text-coral" aria-hidden="true" />Take turns</li>
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5"><Ear className="size-4 text-purple" aria-hidden="true" />Listen to everyone</li>
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5"><Hand className="size-4 text-teal" aria-hidden="true" />Build on an idea</li>
      </ul>
      {hasIdeas ? (
        <div className="mt-8 w-full max-w-xl">
          <button type="button" aria-expanded={peek} onClick={() => setPeek((p) => !p)} className="mx-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-ink-muted hover:bg-white/70">
            {peek ? "Hide" : "Peek at"} {ownOnly ? "your ideas from earlier" : <>your group&apos;s ideas</>}<ChevronDown className={cn("size-4 transition", peek && "rotate-180")} aria-hidden="true" />
          </button>
          {peek && ownOnly ? <div className="mt-3 text-left [&>div]:p-0 [&>div>p:first-child]:hidden"><MyEarlierIdeas /></div> : null}
          {peek && !ownOnly ? (
            <ul className="mt-3 flex flex-col gap-2 text-left">
              {ideas.map((i) => <li key={i.id} className="rounded-2xl bg-white/90 px-4 py-2.5 shadow-soft"><span className="font-medium">{i.body}</span> <span className="text-xs text-ink-muted">— {i.author}</span></li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="mt-auto w-full max-w-xl pt-8">
        <div className="rounded-3xl bg-white/80 px-4 py-3 shadow-soft"><Readiness /></div>
      </div>
    </section>
  );
}
