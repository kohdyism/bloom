import { cn } from "@/lib/utils";

export type MascotMood = "idle" | "happy" | "thinking" | "celebrate" | "wave";

/**
 * Sprout — Bloom's companion. An abstract seed-shaped character with small
 * fox-like ears and a leaf tail. Decorative by default (aria-hidden); callers
 * provide any text the mascot "says" as real, readable content.
 */
export function Mascot({ mood = "idle", size = 72, className, animate = true }: { mood?: MascotMood; size?: number; className?: string; animate?: boolean }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn("shrink-0 overflow-visible", animate && "animate-bob", className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* leaf tail */}
      <g className={animate ? "animate-tail" : undefined}>
        <path d="M86 86c14 2 24-6 26-20-10-1-19 3-24 11" fill="var(--mint)" opacity="0.85" />
        <path d="M88 84c7-3 13-8 18-15" stroke="var(--teal-strong)" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.5" />
      </g>
      {/* ears */}
      <path d="M36 34 34 16c0-3 3-4 5-2l13 15z" fill="var(--teal)" />
      <path d="M84 34 86 16c0-3-3-4-5-2L68 29z" fill="var(--teal)" />
      <path d="M38 30 37 21l8 8z" fill="var(--teal-soft)" />
      <path d="M82 30 83 21l-8 8z" fill="var(--teal-soft)" />
      {/* body */}
      <path d="M60 22c24 0 38 20 38 46 0 22-16 36-38 36S22 90 22 68c0-26 14-46 38-46z" fill="var(--teal)" />
      <path d="M60 46c15 0 25 11 25 25 0 14-11 23-25 23S35 85 35 71c0-14 10-25 25-25z" fill="var(--teal-soft)" opacity="0.95" />
      {/* sprout on head */}
      <path d="M60 23c0-6 2-10 6-12" stroke="var(--teal-strong)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M66 11c5-3 11-2 13 2-5 3-10 2-13-2z" fill="var(--mint)" />
      {/* face */}
      <Face mood={mood} />
      {/* cheeks */}
      <ellipse cx="44" cy="74" rx="5" ry="3" fill="var(--coral)" opacity="0.18" />
      <ellipse cx="76" cy="74" rx="5" ry="3" fill="var(--coral)" opacity="0.18" />
      {mood === "wave" ? <path d="M95 60c6-4 9-10 8-15" stroke="var(--teal)" strokeWidth="7" strokeLinecap="round" fill="none" /> : null}
      {mood === "celebrate" ? (
        <g fill="var(--amber)" opacity="0.9">
          <circle cx="18" cy="30" r="2.5" />
          <circle cx="104" cy="26" r="2" />
          <path d="M100 42l2 4 4 1-4 2-2 4-1-4-4-2 4-1z" />
          <path d="M14 50l1.5 3 3 1-3 1.5-1.5 3-1-3-3-1.5 3-1z" />
        </g>
      ) : null}
    </svg>
  );
}

function Face({ mood }: { mood: MascotMood }) {
  const ink = "#16323a";
  if (mood === "happy" || mood === "celebrate" || mood === "wave") {
    return (
      <g stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M45 64c2-4 7-4 9 0" />
        <path d="M66 64c2-4 7-4 9 0" />
        <path d="M54 76c3 3 9 3 12 0" strokeWidth="2.4" />
      </g>
    );
  }
  if (mood === "thinking") {
    return (
      <g>
        <ellipse cx="50" cy="62" rx="3.4" ry="4.2" fill={ink} />
        <ellipse cx="71" cy="62" rx="3.4" ry="4.2" fill={ink} />
        <circle cx="51" cy="60.5" r="1.1" fill="#fff" />
        <circle cx="72" cy="60.5" r="1.1" fill="#fff" />
        <path d="M56 78h8" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="50" cy="64" rx="3.4" ry="4.4" fill={ink} />
      <ellipse cx="71" cy="64" rx="3.4" ry="4.4" fill={ink} />
      <circle cx="51.2" cy="62.4" r="1.2" fill="#fff" />
      <circle cx="72.2" cy="62.4" r="1.2" fill="#fff" />
      <path d="M55 76c3 2 7 2 10 0" stroke={ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** A mascot with a speech bubble. The text is real content for screen readers. */
export function MascotSays({ children, mood = "idle", className, size = 56, label = "Sprout" }: { children: React.ReactNode; mood?: MascotMood; className?: string; size?: number; label?: string }) {
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <Mascot mood={mood} size={size} />
      <div className="relative rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 text-[0.95rem] shadow-soft">
        <span className="sr-only">{label} says: </span>
        {children}
      </div>
    </div>
  );
}
