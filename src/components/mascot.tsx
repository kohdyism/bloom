import { cn } from "@/lib/utils";

/**
 * Canopy's two helpers. Both are decorative (aria-hidden); callers always
 * provide what they "say" as real, readable text.
 *  - Bloom (a smiling flower) is the GROUP facilitator: what Bloom says, the whole group sees.
 *  - Pip (a calm pebble) is the one-to-one helper: the group never sees Pip's answers (the teacher can).
 * Pure SVG with CSS-only motion so they render anywhere; motion stops under reduced-motion.
 */
export type Mood = "idle" | "thinking" | "happy" | "resting" | "celebrate" | "talking" | "listening";
/** Older mood names still used around the app map onto the new set. */
export type MascotMood = Mood | "wave" | "sleepy" | "surprised";
const normalise = (m: MascotMood): Mood => (m === "wave" || m === "surprised" ? "happy" : m === "sleepy" ? "resting" : m);

const INK = "#1d1a2e";

export function Bloom({ mood = "idle", size = 64, className, animate = true }: { mood?: MascotMood; size?: number; className?: string; animate?: boolean }) {
  const m = normalise(mood);
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={cn("shrink-0 overflow-visible", className)} aria-hidden="true" focusable="false">
      <g className={animate ? "buddy-float" : undefined}>
        {/* stem and leaves */}
        <path d="M100 140c-2 22 2 38 0 56" stroke="#2f9e44" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M100 182c-17 2-31-5-38-19 17-3 31 5 38 19z" fill="#86e05f" />
        <path d="M100 190c15-1 28-8 33-21-15-2-28 7-33 21z" fill="#3fca6e" />
        {/* petals */}
        <g className={animate ? "bloom-petals" : undefined}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((d, i) => (
            <ellipse key={d} cx="100" cy="52" rx="21" ry="26" fill={i % 2 ? "#ff8fc2" : "#ff7f6e"} transform={`rotate(${d} 100 92)`} />
          ))}
        </g>
        {/* face */}
        <circle cx="100" cy="92" r="41" fill="#ffd166" />
        <circle cx="100" cy="92" r="41" fill="none" stroke="#ffb020" strokeWidth="3" opacity="0.6" />
        <ellipse cx="74" cy="104" rx="7.5" ry="4.5" fill="#ff8fa6" opacity="0.6" />
        <ellipse cx="126" cy="104" rx="7.5" ry="4.5" fill="#ff8fa6" opacity="0.6" />
        <BloomFace mood={m} animate={animate} />
      </g>
      {m === "celebrate" || m === "happy" ? (
        <g>
          <circle cx="166" cy="34" r="6" fill="#ffc83d" />
          <circle cx="34" cy="158" r="5" fill="#ff8fc2" />
          {m === "celebrate" ? <path d="M176 120l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#7c5cff" /> : null}
        </g>
      ) : null}
      {m === "resting" ? <Zzz x={158} y={36} color="#ff5fa2" /> : null}
      {m === "thinking" ? <g fill="#ffb067"><circle cx="168" cy="40" r="6" /><circle cx="184" cy="20" r="9" /></g> : null}
    </svg>
  );
}

function BloomFace({ mood, animate }: { mood: Mood; animate: boolean }) {
  if (mood === "talking") {
    return (
      <g>
        <circle cx="86" cy="86" r="8.5" fill={INK} /><circle cx="114" cy="86" r="8.5" fill={INK} />
        <circle cx="88.8" cy="83.2" r="2.8" fill="#fff" /><circle cx="116.8" cy="83.2" r="2.8" fill="#fff" />
        <ellipse cx="100" cy="106" rx="7" ry="6" fill={INK} className={animate ? "buddy-mouth-talk" : undefined} />
      </g>
    );
  }
  if (mood === "listening") {
    return (
      <g>
        <g className={animate ? "buddy-blink" : undefined}>
          <circle cx="90" cy="90" r="8.5" fill={INK} /><circle cx="118" cy="90" r="8.5" fill={INK} />
          <circle cx="93.5" cy="89" r="2.8" fill="#fff" /><circle cx="121.5" cy="89" r="2.8" fill="#fff" />
        </g>
        <path d="M94 106c5 4 12 4 17 0" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
      </g>
    );
  }
  if (mood === "happy" || mood === "celebrate") {
    return (
      <g stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M77 90c3-8 13-8 16 0M107 90c3-8 13-8 16 0" />
        <path d="M88 102c7 10 17 10 24 0z" fill={INK} strokeWidth="3" />
      </g>
    );
  }
  if (mood === "resting") {
    return (
      <g stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M77 90c3 5 13 5 16 0M107 90c3 5 13 5 16 0" />
        <circle cx="100" cy="106" r="4" fill={INK} stroke="none" />
      </g>
    );
  }
  const up = mood === "thinking" ? -5 : 0;
  return (
    <g>
      <g className={animate ? "buddy-blink" : undefined}>
        <circle cx="86" cy={88 + up} r="8.5" fill={INK} />
        <circle cx="114" cy={88 + up} r="8.5" fill={INK} />
        <circle cx="88.8" cy={85.2 + up} r="2.8" fill="#fff" />
        <circle cx="116.8" cy={85.2 + up} r="2.8" fill="#fff" />
      </g>
      {mood === "thinking" ? <path d="M94 108h12" stroke={INK} strokeWidth="5" strokeLinecap="round" /> : <path d="M90 104c6 5 14 5 20 0" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />}
    </g>
  );
}

export function Pip({ mood = "idle", size = 64, className, animate = true }: { mood?: MascotMood; size?: number; className?: string; animate?: boolean }) {
  const m = normalise(mood);
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={cn("shrink-0 overflow-visible", className)} aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="188" rx="50" ry="7" fill="rgb(45 25 110 / 0.12)" />
      <g className={animate ? "buddy-breathe" : undefined}>
        <path d="M100 30c48 0 70 38 70 82 0 42-30 70-70 70s-70-28-70-70c0-44 22-82 70-82z" fill="#7c5cff" />
        <path d="M62 60c10-14 26-20 40-20" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity="0.32" fill="none" />
        <ellipse cx="68" cy="128" rx="9" ry="5.5" fill="#ff8fc2" opacity="0.55" />
        <ellipse cx="132" cy="128" rx="9" ry="5.5" fill="#ff8fc2" opacity="0.55" />
        <PipFace mood={m} animate={animate} />
      </g>
      {m === "celebrate" ? <g><circle cx="168" cy="40" r="6" fill="#ffc83d" /><path d="M30 54l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ff7f6e" /></g> : null}
      {m === "resting" ? <Zzz x={150} y={44} color="#7c5cff" /> : null}
      {m === "thinking" ? <g fill="#c9bcff"><circle cx="160" cy="46" r="6" /><circle cx="176" cy="26" r="9" /></g> : null}
    </svg>
  );
}

function PipFace({ mood, animate }: { mood: Mood; animate: boolean }) {
  if (mood === "talking") {
    return (
      <g>
        <circle cx="80" cy="104" r="9.5" fill={INK} /><circle cx="120" cy="104" r="9.5" fill={INK} />
        <circle cx="83" cy="101" r="3.2" fill="#fff" /><circle cx="123" cy="101" r="3.2" fill="#fff" />
        <ellipse cx="100" cy="130" rx="9" ry="7" fill={INK} className={animate ? "buddy-mouth-talk" : undefined} />
      </g>
    );
  }
  if (mood === "listening") {
    return (
      <g>
        <g className={animate ? "buddy-blink" : undefined}>
          <circle cx="85" cy="110" r="9.5" fill={INK} /><circle cx="125" cy="110" r="9.5" fill={INK} />
          <circle cx="88.5" cy="108" r="3.2" fill="#fff" /><circle cx="128.5" cy="108" r="3.2" fill="#fff" />
        </g>
        <path d="M91 130c6 5 15 5 21 0" stroke={INK} strokeWidth="5.5" strokeLinecap="round" fill="none" />
      </g>
    );
  }
  if (mood === "happy" || mood === "celebrate") {
    return (
      <g stroke={INK} strokeWidth="5.5" strokeLinecap="round" fill="none">
        <path d="M70 108c4-9 16-9 20 0M110 108c4-9 16-9 20 0" />
        <path d="M84 126c9 12 23 12 32 0z" fill={INK} strokeWidth="3" />
      </g>
    );
  }
  if (mood === "resting") {
    return (
      <g stroke={INK} strokeWidth="5.5" strokeLinecap="round" fill="none">
        <path d="M70 108c4 6 16 6 20 0M110 108c4 6 16 6 20 0" />
        <circle cx="100" cy="132" r="5" fill={INK} stroke="none" />
      </g>
    );
  }
  const up = mood === "thinking" ? -6 : 0;
  return (
    <g>
      <g className={animate ? "buddy-blink" : undefined}>
        <circle cx="80" cy={106 + up} r="9.5" fill={INK} />
        <circle cx="120" cy={106 + up} r="9.5" fill={INK} />
        <circle cx="83" cy={103 + up} r="3.2" fill="#fff" />
        <circle cx="123" cy={103 + up} r="3.2" fill="#fff" />
      </g>
      {mood === "thinking" ? <path d="M92 132h16" stroke={INK} strokeWidth="5.5" strokeLinecap="round" /> : <path d="M88 128c7 6 17 6 24 0" stroke={INK} strokeWidth="5.5" strokeLinecap="round" fill="none" />}
    </g>
  );
}

function Zzz({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g fill={color} fontFamily="var(--font-display)" fontWeight="700">
      <text x={x} y={y} fontSize="26">z</text>
      <text x={x + 18} y={y - 18} fontSize="20">z</text>
    </g>
  );
}

/** Default character (Bloom) — kept under the old name for existing call sites. */
export function Mascot(props: { mood?: MascotMood; size?: number; className?: string; animate?: boolean }) {
  return <Bloom {...props} />;
}

/** A helper with a speech bubble. The text is real content for screen readers. */
export function MascotSays({ children, mood = "idle", className, size = 56, who = "bloom" }: { children: React.ReactNode; mood?: MascotMood; className?: string; size?: number; who?: "bloom" | "pip"; label?: string }) {
  const C = who === "pip" ? Pip : Bloom;
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <C mood={mood} size={size} />
      <div className="relative rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 text-[0.95rem] shadow-soft">
        <span className="sr-only">{who === "pip" ? "Pip" : "Bloom"} says: </span>
        {children}
      </div>
    </div>
  );
}
