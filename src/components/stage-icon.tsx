import {
  Compass, Users, Lightbulb, Sparkles, MessagesSquare, Vote, PenLine, Hammer, Send, Presentation, HeartHandshake, type LucideIcon,
} from "lucide-react";
import type { StageKind } from "@/lib/domain/lesson";
import { cn } from "@/lib/utils";

export const STAGE_ICONS: Record<StageKind, { icon: LucideIcon; tone: string }> = {
  orientation: { icon: Compass, tone: "bg-blue-soft text-blue" },
  role_selection: { icon: Users, tone: "bg-purple-soft text-purple" },
  brainstorm: { icon: Lightbulb, tone: "bg-amber-soft text-amber" },
  synthesis: { icon: Sparkles, tone: "bg-purple-soft text-purple" },
  discussion: { icon: MessagesSquare, tone: "bg-teal-soft text-teal-strong" },
  voting: { icon: Vote, tone: "bg-blue-soft text-blue" },
  creation: { icon: PenLine, tone: "bg-mint-soft text-mint" },
  physical: { icon: Hammer, tone: "bg-amber-soft text-amber" },
  submission: { icon: Send, tone: "bg-teal-soft text-teal-strong" },
  presentation: { icon: Presentation, tone: "bg-coral-soft text-coral" },
  reflection: { icon: HeartHandshake, tone: "bg-mint-soft text-mint" },
};

export function StageIcon({ kind, className }: { kind: StageKind; className?: string }) {
  const { icon: Icon, tone } = STAGE_ICONS[kind];
  return (
    <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl", tone, className)} aria-hidden="true">
      <Icon className="size-[1.1rem]" />
    </span>
  );
}
