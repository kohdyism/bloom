"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flower2, X } from "lucide-react";
import { Dialog as RDialog } from "radix-ui";
import { FlowerPicture } from "@/components/flower";
import { Button } from "@/components/ui/button";
import { useA11y } from "@/components/a11y-provider";
import { flowerInfo } from "@/lib/domain/flowers";
import { playSfx } from "@/lib/sfx";
import { useWorkspace } from "./context";

const seenKey = (groupId: string) => `canopy.bloomSeen.${groupId}`;

/**
 * When the group's plant opens into its flower, show it once: which flower it
 * is, and that it's now in everyone's garden. The group shares the flower —
 * it's a celebration of working together, never a score.
 */
export function BloomReveal() {
  const { group } = useWorkspace();
  const { prefs } = useA11y();
  const [open, setOpen] = useState(false);
  const flower = group.flower;

  useEffect(() => {
    if (!flower) return;
    let seen = false;
    try { seen = window.localStorage.getItem(seenKey(group.id)) === flower; } catch { /* storage blocked: show it */ }
    if (seen) return;
    try { window.localStorage.setItem(seenKey(group.id), flower); } catch { /* fine */ }
    // Showing the reveal follows a server change (the group just bloomed).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
    if (prefs.sound) playSfx("grow");
  }, [flower, group.id, prefs.sound]);

  if (!flower) return null;
  const info = flowerInfo(flower);
  return (
    <RDialog.Root open={open} onOpenChange={setOpen}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-[65] bg-ink/30 backdrop-blur-[2px]" />
        <RDialog.Content className="animate-pop fixed left-1/2 top-1/2 z-[66] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-[2rem] border-2 border-white bg-gradient-to-b from-[#fff7e8] to-white px-6 pb-6 pt-8 text-center shadow-lift">
          <RDialog.Close className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-2" aria-label="Close"><X className="size-5" /></RDialog.Close>
          <div className={prefs.celebrations ? "bloom-pop" : undefined}><FlowerPicture id={flower} size={140} /></div>
          <p className="text-sm font-bold uppercase tracking-wide text-purple">Your group&apos;s plant bloomed!</p>
          <RDialog.Title className="font-display text-4xl font-bold leading-tight">{info.name}</RDialog.Title>
          <RDialog.Description className="text-lg text-ink-muted">{info.blurb} It&apos;s now in the garden of everyone in group {group.name}.</RDialog.Description>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button asChild variant="secondary"><Link href="/student/garden"><Flower2 />See my garden</Link></Button>
            <RDialog.Close asChild><Button>Lovely!</Button></RDialog.Close>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
