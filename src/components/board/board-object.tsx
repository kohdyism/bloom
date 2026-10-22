import { BOARD_COLORS, type BoardObject } from "@/lib/domain/artifact-model";

export const colorValue = (c: string) => (BOARD_COLORS as Record<string, string>)[c] ?? c;
const isDark = (c: string) => ["ink", "teal", "blue", "purple", "coral"].includes(c);

/** Pure SVG rendering of one board/slide object, shared by editor, viewer and presentation. */
export function BoardObjectShape({ o, mediaUrl, editing }: { o: BoardObject; mediaUrl: (id: string) => string; editing?: boolean }) {
  const fill = colorValue(o.color);
  switch (o.type) {
    case "sticky":
      return (
        <g>
          <rect x={o.x + 3} y={o.y + 5} width={o.w} height={o.h} rx="6" fill="rgb(27 36 48 / 0.10)" />
          <rect x={o.x} y={o.y} width={o.w} height={o.h} rx="6" fill={fill} stroke="rgb(27 36 48 / 0.12)" />
          {!editing ? <TextBox o={o} color="#1b2430" pad={14} /> : null}
        </g>
      );
    case "text":
      return !editing ? <TextBox o={o} color={isDark(o.color) ? fill : "#1b2430"} pad={4} /> : null;
    case "rect":
      return (
        <g>
          <rect x={o.x} y={o.y} width={o.w} height={o.h} rx="10" fill={fill} stroke={isDark(o.color) ? fill : "rgb(27 36 48 / 0.35)"} strokeWidth="2" fillOpacity={isDark(o.color) ? 0.15 : 1} />
          {o.text && !editing ? <TextBox o={o} color="#1b2430" pad={12} center /> : null}
        </g>
      );
    case "ellipse":
      return (
        <g>
          <ellipse cx={o.x + o.w / 2} cy={o.y + o.h / 2} rx={Math.abs(o.w / 2)} ry={Math.abs(o.h / 2)} fill={fill} stroke={isDark(o.color) ? fill : "rgb(27 36 48 / 0.35)"} strokeWidth="2" fillOpacity={isDark(o.color) ? 0.15 : 1} />
          {o.text && !editing ? <TextBox o={o} color="#1b2430" pad={18} center /> : null}
        </g>
      );
    case "arrow": {
      const x2 = o.x2 ?? o.x + o.w;
      const y2 = o.y2 ?? o.y + o.h;
      const angle = Math.atan2(y2 - o.y, x2 - o.x);
      const head = 16;
      const p1 = [x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45)];
      const p2 = [x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45)];
      const stroke = isDark(o.color) ? fill : "#1b2430";
      return (
        <g>
          <line x1={o.x} y1={o.y} x2={x2} y2={y2} stroke={stroke} strokeWidth="4" strokeLinecap="round" />
          <path d={`M${x2} ${y2} L${p1[0]} ${p1[1]} L${p2[0]} ${p2[1]} Z`} fill={stroke} />
        </g>
      );
    }
    case "path":
      return <polyline points={o.points ?? ""} fill="none" stroke={isDark(o.color) ? fill : "#1b2430"} strokeWidth={o.fontSize ?? 4} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${o.x} ${o.y})`} />;
    case "image":
      return o.mediaId ? (
        <image href={mediaUrl(o.mediaId)} x={o.x} y={o.y} width={o.w} height={o.h} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="var(--surface-2)" />
      );
  }
}

function TextBox({ o, color, pad, center }: { o: BoardObject; color: string; pad: number; center?: boolean }) {
  return (
    <foreignObject x={o.x} y={o.y} width={Math.max(10, o.w)} height={Math.max(10, o.h)}>
      <div
        style={{
          padding: pad, color, fontSize: o.fontSize ?? 22, lineHeight: 1.25, whiteSpace: "pre-wrap", overflowWrap: "anywhere", height: "100%", overflow: "hidden",
          fontFamily: "var(--font-sans)", display: center ? "flex" : "block", alignItems: "center", justifyContent: "center", textAlign: center ? "center" : "left",
        }}
      >
        {o.text}
      </div>
    </foreignObject>
  );
}

export function BoardView({ objects, viewBox, mediaUrl, className, title }: { objects: BoardObject[]; viewBox: string; mediaUrl: (id: string) => string; className?: string; title: string }) {
  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={title}>
      <title>{title}</title>
      {objects.map((o) => <BoardObjectShape key={o.id} o={o} mediaUrl={mediaUrl} />)}
    </svg>
  );
}

/** Text alternative for a board, for screen readers and the outline view. */
export function boardOutline(objects: BoardObject[]): string[] {
  return objects.filter((o) => o.text?.trim()).map((o) => `${o.type === "sticky" ? "Sticky note" : o.type === "text" ? "Text" : "Shape"}: ${o.text!.trim()}`);
}

export function boardBounds(objects: BoardObject[], pad = 60): string {
  if (!objects.length) return "0 0 1200 800";
  const xs = objects.flatMap((o) => [o.x, o.x + o.w, o.x2 ?? o.x]);
  const ys = objects.flatMap((o) => [o.y, o.y + o.h, o.y2 ?? o.y]);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return `${minX} ${minY} ${Math.max(400, Math.max(...xs) - minX + pad)} ${Math.max(300, Math.max(...ys) - minY + pad)}`;
}
