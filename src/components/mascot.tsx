import { cn } from "@/lib/utils";

export type MascotMood = "idle" | "happy" | "thinking" | "celebrate" | "wave" | "sleepy" | "surprised";

const INK = "#1d1a2e";

/**
 * Sprout — Bloom's companion: a round seedling with two leaves on top.
 * Decorative by default (aria-hidden); callers provide any text the mascot
 * "says" as real, readable content. Pure SVG with CSS-only motion, so it can
 * render in server components; all motion stops under reduced-motion.
 */
export function Mascot({ mood = "idle", size = 72, className, animate = true }: { mood?: MascotMood; size?: number; className?: string; animate?: boolean }) {
  return (
    <svg viewBox="0 0 120 124" width={size} height={size} className={cn("shrink-0 overflow-visible", className)} aria-hidden="true" focusable="false">
      {/* ground shadow */}
      <ellipse cx="60" cy="118" rx="28" ry="4.5" fill="rgb(45 25 110 / 0.14)" />
      <g className={animate ? "sprout-body" : undefined}>
        {/* feet */}
        <ellipse cx="46" cy="113" rx="9" ry="5" fill="#16884d" />
        <ellipse cx="74" cy="113" rx="9" ry="5" fill="#16884d" />
        {/* arms */}
        {mood === "wave" || mood === "celebrate" ? (
          <>
            <path d="M99 74c8-6 11-15 9-23" stroke="#25a865" strokeWidth="8" strokeLinecap="round" fill="none" />
            {mood === "celebrate" ? <path d="M21 74c-8-6-11-15-9-23" stroke="#25a865" strokeWidth="8" strokeLinecap="round" fill="none" /> : <path d="M22 80c-6 3-9 8-9 12" stroke="#25a865" strokeWidth="8" strokeLinecap="round" fill="none" />}
          </>
        ) : (
          <>
            <path d="M22 80c-6 3-9 8-9 12" stroke="#25a865" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M98 80c6 3 9 8 9 12" stroke="#25a865" strokeWidth="8" strokeLinecap="round" fill="none" />
          </>
        )}
        {/* body */}
        <path d="M60 30c27 0 41 21 41 46 0 23-17 37-41 37S19 99 19 76c0-25 14-46 41-46z" fill="#2fbf71" />
        <ellipse cx="42" cy="50" rx="11" ry="6" fill="#ffffff" opacity="0.32" transform="rotate(-32 42 50)" />
        <ellipse cx="60" cy="88" rx="25" ry="19" fill="#dffbe9" />
        {/* stem + leaves */}
        <path d="M60 31c0-8 1.5-14 4-18" stroke="#16884d" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <g className={animate ? "sprout-leaf" : undefined}>
          <path d="M63 14c-9-9-22-8-27 0 9 7 20 7 27 0z" fill="#86e05f" />
          <path d="M63 14c-7-1-15-1-22 0" stroke="#4cae3a" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M64 13c6-11 19-13 27-7-6 10-17 12-27 7z" fill="#3fca6e" />
          <path d="M64 13c7-3 14-5 22-6" stroke="#1f9d55" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.7" />
        </g>
        {/* cheeks */}
        <ellipse cx="40" cy="79" rx="6.5" ry="4" fill="#ff6fa3" opacity="0.5" />
        <ellipse cx="80" cy="79" rx="6.5" ry="4" fill="#ff6fa3" opacity="0.5" />
        <Face mood={mood} animate={animate} />
      </g>
      {mood === "celebrate" ? (
        <g>
          <path d="M14 30l2.5 5 5 1.5-5 2-2.5 5-1.5-5-5-2 5-1.5z" fill="var(--sun)" />
          <path d="M104 24l2 4 4 1-4 2-2 4-1-4-4-2 4-1z" fill="#ff6fa3" />
          <circle cx="98" cy="44" r="3" fill="var(--purple)" />
          <circle cx="22" cy="52" r="2.5" fill="#3fa9f5" />
        </g>
      ) : null}
    </svg>
  );
}

function Face({ mood, animate }: { mood: MascotMood; animate: boolean }) {
  if (mood === "happy" || mood === "celebrate" || mood === "wave") {
    return (
      <g stroke={INK} strokeWidth="3.4" strokeLinecap="round" fill="none">
        <path d="M43 68c2.5-4.5 8-4.5 10.5 0" />
        <path d="M66.5 68c2.5-4.5 8-4.5 10.5 0" />
        <path d="M51 80c4 5 14 5 18 0" fill="#ff8fb4" strokeWidth="2.6" />
      </g>
    );
  }
  if (mood === "sleepy") {
    return (
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M43 68c2.5 3 8 3 10.5 0" />
        <path d="M66.5 68c2.5 3 8 3 10.5 0" />
        <ellipse cx="60" cy="82" rx="3" ry="3.6" fill={INK} stroke="none" />
      </g>
    );
  }
  if (mood === "surprised") {
    return (
      <g>
        <circle cx="48" cy="67" r="5.5" fill={INK} />
        <circle cx="72" cy="67" r="5.5" fill={INK} />
        <circle cx="49.8" cy="65" r="1.8" fill="#fff" />
        <circle cx="73.8" cy="65" r="1.8" fill="#fff" />
        <ellipse cx="60" cy="83" rx="4.5" ry="5.5" fill={INK} />
      </g>
    );
  }
  const look = mood === "thinking" ? -3 : 0;
  return (
    <g>
      <g className={animate ? "sprout-eyes" : undefined}>
        <ellipse cx="48" cy={68 + look} rx="4.4" ry="5.6" fill={INK} />
        <ellipse cx="72" cy={68 + look} rx="4.4" ry="5.6" fill={INK} />
        <circle cx="49.6" cy={65.8 + look} r="1.7" fill="#fff" />
        <circle cx="73.6" cy={65.8 + look} r="1.7" fill="#fff" />
      </g>
      {mood === "thinking" ? (
        <path d="M55 82h10" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
      ) : (
        <path d="M53 79c4 4 10 4 14 0" stroke={INK} strokeWidth="2.8" strokeLinecap="round" fill="none" />
      )}
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
