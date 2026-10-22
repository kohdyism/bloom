"use client";

import { useState } from "react";
import { ChevronDown, Ear, Hand, Repeat2 } from "lucide-react";
import { Buddy } from "@/components/buddy";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { useWorkspace } from "./context";

/**
 * Talk time: the screen steps back. A calm, nearly blank page with one big
 * message, Bloom at the top telling the group to talk face to face, and the
 * question to talk about. The group's ideas are tucked away in case anyone
 * wants a reminder.
 */
export function TalkTime() {
  const { group } = useWorkspace();
  const [peek, setPeek] = useState(false);
  const small = !useMediaQuery("(min-width: 640px)");
  const ideas = group.ideas.shared;
  return (
    <section aria-labelledby="talk-title" className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-gradient-to-b from-[#fff3e6] via-[#ffeef6] to-[#efe9ff] px-5 py-6 text-center sm:py-12">
      <div className="flex flex-col items-center gap-3">
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
        <p className="mt-5 max-w-2xl font-display text-xl font-semibold leading-snug text-ink/85 sm:mt-6 sm:text-3xl">{group.stage.instructions}</p>
      ) : null}
      <ul className="mt-8 flex flex-wrap justify-center gap-2 text-sm font-semibold text-ink-muted sm:text-base" aria-label="Tips">
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5"><Repeat2 className="size-4 text-coral" aria-hidden="true" />Take turns</li>
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5"><Ear className="size-4 text-purple" aria-hidden="true" />Listen to everyone</li>
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5"><Hand className="size-4 text-teal" aria-hidden="true" />Build on an idea</li>
      </ul>
      {ideas.length ? (
        <div className="mt-8 w-full max-w-xl">
          <button type="button" aria-expanded={peek} onClick={() => setPeek((p) => !p)} className="mx-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-ink-muted hover:bg-white/70">
            {peek ? "Hide" : "Peek at"} your group&apos;s ideas<ChevronDown className={cn("size-4 transition", peek && "rotate-180")} aria-hidden="true" />
          </button>
          {peek ? (
            <ul className="mt-3 flex flex-col gap-2 text-left">
              {ideas.map((i) => <li key={i.id} className="rounded-2xl bg-white/90 px-4 py-2.5 shadow-soft"><span className="font-medium">{i.body}</span> <span className="text-xs text-ink-muted">— {i.author}</span></li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
