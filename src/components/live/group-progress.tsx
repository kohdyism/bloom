"use client";

import { cn } from "@/lib/utils";

/**
 * Cooperative progress visual (spec §23). Grows only with completed stages —
 * never with message counts, speed or individual activity. No rankings.
 */
export function GroupProgress({ theme, progress, stagesDone, totalStages, size = 120, className, label }: {
  theme: string; progress: number; stagesDone: number; totalStages: number; size?: number; className?: string; label?: string;
}) {
  const desc = label ?? `Group progress: ${stagesDone} of ${totalStages} stages complete`;
  if (theme === "none") return null;
  return (
    <figure className={cn("flex flex-col items-center", className)} role="img" aria-label={desc}>
      {theme === "constellation" ? <Constellation progress={progress} total={totalStages} size={size} /> : theme === "journey" ? <Journey progress={progress} total={totalStages} size={size} /> : <Garden progress={progress} size={size} />}
    </figure>
  );
}

function Garden({ progress, size }: { progress: number; size: number }) {
  const stem = 20 + progress * 50;
  const leaves = Math.floor(progress * 4);
  const bloom = progress >= 1;
  const bud = progress >= 0.6;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <ellipse cx="60" cy="108" rx="40" ry="8" fill="var(--mint-soft)" />
      <path d="M38 104h44l-5 12H43z" fill="var(--amber)" opacity="0.55" />
      <path d={`M60 104 C 58 ${104 - stem / 2}, 62 ${104 - stem / 2}, 60 ${104 - stem}`} stroke="var(--mint)" strokeWidth="4" fill="none" strokeLinecap="round" style={{ transition: "d 600ms ease" }} />
      {Array.from({ length: leaves }).map((_, i) => {
        const y = 98 - i * 12;
        const left = i % 2 === 0;
        return <path key={i} d={left ? `M60 ${y}c-10-2-16-8-16-14 8 0 14 6 16 14z` : `M60 ${y}c10-2 16-8 16-14-8 0-14 6-16 14z`} fill="var(--mint)" opacity="0.85" />;
      })}
      {bud && !bloom ? <circle cx="60" cy={104 - stem} r="6" fill="var(--purple)" opacity="0.7" /> : null}
      {bloom ? (
        <g transform={`translate(60 ${104 - stem})`}>
          {[0, 60, 120, 180, 240, 300].map((r) => (
            <ellipse key={r} cx="0" cy="-10" rx="6" ry="10" fill="var(--purple)" opacity="0.75" transform={`rotate(${r})`} />
          ))}
          <circle r="6" fill="var(--amber)" />
        </g>
      ) : null}
    </svg>
  );
}

function Constellation({ progress, total, size }: { progress: number; total: number; size: number }) {
  const n = Math.max(3, Math.min(10, total));
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = 34 + (i % 2) * 12;
    return [60 + Math.cos(a) * r, 60 + Math.sin(a) * r * 0.85];
  });
  const lit = Math.round(progress * n);
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <rect x="4" y="4" width="112" height="112" rx="20" fill="var(--blue-soft)" />
      {pts.slice(0, Math.max(0, lit)).map((p, i) => {
        const q = pts[(i + 1) % n];
        return i + 1 < lit || (lit === n && i === n - 1) ? <line key={i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="var(--blue)" strokeWidth="1.6" opacity="0.6" /> : null;
      })}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i < lit ? 4 : 2.4} fill={i < lit ? "var(--amber)" : "var(--line-strong)"} />
      ))}
    </svg>
  );
}

function Journey({ progress, total, size }: { progress: number; total: number; size: number }) {
  const n = Math.max(2, total);
  const path = "M14 100 C 40 100, 30 60, 60 62 S 90 30, 106 18";
  const checkpoints = Array.from({ length: n }, (_, i) => i / (n - 1));
  const at = (t: number) => {
    // Approximate position along the curve using two cubic segments.
    const seg = t < 0.5 ? 0 : 1;
    const u = seg === 0 ? t * 2 : (t - 0.5) * 2;
    const P = seg === 0 ? [[14, 100], [40, 100], [30, 60], [60, 62]] : [[60, 62], [90, 64], [90, 30], [106, 18]];
    const b = (k: number) => (1 - u) ** 3 * P[0][k] + 3 * (1 - u) ** 2 * u * P[1][k] + 3 * (1 - u) * u ** 2 * P[2][k] + u ** 3 * P[3][k];
    return [b(0), b(1)];
  };
  const me = at(progress);
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <rect x="4" y="4" width="112" height="112" rx="20" fill="var(--amber-soft)" opacity="0.6" />
      <path d={path} stroke="var(--line-strong)" strokeWidth="5" strokeDasharray="2 6" strokeLinecap="round" fill="none" />
      {checkpoints.map((t, i) => {
        const [x, y] = at(t);
        return <circle key={i} cx={x} cy={y} r="4.5" fill={t <= progress + 0.001 ? "var(--teal)" : "var(--surface)"} stroke="var(--teal)" strokeWidth="2" />;
      })}
      <path d={`M106 18 v-12 l10 5 -10 5`} fill="var(--coral)" stroke="var(--coral)" strokeWidth="1.5" />
      <circle cx={me[0]} cy={me[1]} r="7" fill="var(--purple)" stroke="white" strokeWidth="2" style={{ transition: "cx 600ms, cy 600ms" }} />
    </svg>
  );
}
