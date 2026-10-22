import type { FlowerId } from "@/lib/domain/flowers";

/**
 * Flower heads for the collectible garden, drawn around (0, 0) in a box about
 * 24 units across. Decorative only — callers give the flower's name as text.
 */
export function FlowerHead({ id }: { id: FlowerId }) {
  const ring = (n: number, el: (deg: number, i: number) => React.ReactNode) => Array.from({ length: n }, (_, i) => el((360 / n) * i, i));
  switch (id) {
    case "daisy":
      return (
        <g>
          {ring(14, (d, i) => <ellipse key={i} cx="0" cy="-7" rx="2.2" ry="6" fill="#fff" stroke="#e6e1f0" strokeWidth="0.6" transform={`rotate(${d})`} />)}
          <circle r="4" fill="#ffc83d" />
        </g>
      );
    case "sunflower":
      return (
        <g>
          {ring(18, (d, i) => <path key={i} d="M0 -5 C 2.5 -8, 1.5 -11, 0 -12.5 C -1.5 -11, -2.5 -8, 0 -5Z" fill={i % 2 ? "#ffc83d" : "#ffb020"} transform={`rotate(${d})`} />)}
          <circle r="5.5" fill="#7a4a1e" />
          <circle r="3.5" fill="#5b3412" />
        </g>
      );
    case "tulip":
      return (
        <g>
          <path d="M-7 -2 C -8 -10, -4 -12, -3 -9 L 0 -12 L 3 -9 C 4 -12, 8 -10, 7 -2 C 6 5, -6 5, -7 -2Z" fill="#ff5f7e" />
          <path d="M0 -12 C -3 -6, -3 2, 0 4 C 3 2, 3 -6, 0 -12Z" fill="#ff8fa6" />
        </g>
      );
    case "poppy":
      return (
        <g>
          {ring(4, (d, i) => <circle key={i} cx="0" cy="-5.5" r="6" fill={i % 2 ? "#ff4d3d" : "#ff6a4d"} transform={`rotate(${d + 45})`} />)}
          <circle r="3" fill="#1d1a2e" />
          {ring(8, (d, i) => <circle key={i} cx="0" cy="-3.8" r="0.7" fill="#1d1a2e" transform={`rotate(${d})`} />)}
        </g>
      );
    case "forget_me_not":
      return (
        <g>
          {ring(5, (d, i) => <circle key={i} cx="0" cy="-5.5" r="4.6" fill="#5aa9ff" transform={`rotate(${d})`} />)}
          <circle r="2.8" fill="#fff" />
          <circle r="1.6" fill="#ffc83d" />
        </g>
      );
    case "cherry_blossom":
      return (
        <g>
          {ring(5, (d, i) => <path key={i} d="M0 0 C -5 -3, -5 -10, -1.5 -11 L 0 -9.5 L 1.5 -11 C 5 -10, 5 -3, 0 0Z" fill="#ffb7d2" stroke="#ff8fc2" strokeWidth="0.5" transform={`rotate(${d})`} />)}
          {ring(5, (d, i) => <circle key={i} cx="0" cy="-3.2" r="0.9" fill="#c2185b" transform={`rotate(${d + 36})`} />)}
          <circle r="1.6" fill="#ffd166" />
        </g>
      );
    case "bluebell":
      return (
        <g>
          <path d="M0 -12 C 3 -12, 4 -9, 4 -6" stroke="#2f9e44" strokeWidth="1.2" fill="none" />
          {[[-5, -3], [3.5, -5], [-1, 4]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M-3.5 -3 C -3.5 -6, 3.5 -6, 3.5 -3 L 4.5 2.5 L 2.5 1.5 L 1 3 L -1 1.5 L -2.5 3 L -4.5 2.5Z" fill={i === 1 ? "#6b7cff" : "#5468ff"} />
            </g>
          ))}
        </g>
      );
    case "lavender":
      return (
        <g>
          {[-10, -7, -4, -1, 2, 5].map((y, i) => (
            <g key={i}>
              <ellipse cx="-2" cy={y} rx="2.2" ry="1.8" fill={i % 2 ? "#9b7bff" : "#b49cff"} />
              <ellipse cx="2" cy={y + 1} rx="2.2" ry="1.8" fill={i % 2 ? "#b49cff" : "#8a66ff"} />
            </g>
          ))}
        </g>
      );
    case "rose":
      return (
        <g>
          <circle r="9" fill="#e8365d" />
          <path d="M-6 -2 C -6 -8, 6 -8, 6 -2" stroke="#b81e45" strokeWidth="1.4" fill="none" />
          <path d="M-4 1 C -5 -5, 4 -6, 4 0 C 4 4, -2 4, -2 0" stroke="#b81e45" strokeWidth="1.4" fill="none" />
          <path d="M-7 4 C -3 8, 4 8, 7 3" stroke="#b81e45" strokeWidth="1.2" fill="none" />
        </g>
      );
    case "marigold":
      return (
        <g>
          {ring(12, (d, i) => <circle key={`o${i}`} cx="0" cy="-8" r="3.4" fill="#ff9f1c" transform={`rotate(${d})`} />)}
          {ring(9, (d, i) => <circle key={`m${i}`} cx="0" cy="-4.8" r="3" fill="#ffb627" transform={`rotate(${d + 20})`} />)}
          <circle r="3" fill="#ff8c00" />
        </g>
      );
    case "lotus":
      return (
        <g>
          {[-60, -30, 30, 60].map((d) => <path key={d} d="M0 4 C -4 -2, -3 -9, 0 -12 C 3 -9, 4 -2, 0 4Z" fill="#ffa8c8" transform={`rotate(${d} 0 4)`} />)}
          <path d="M0 4 C -4 -2, -3 -9, 0 -13 C 3 -9, 4 -2, 0 4Z" fill="#ff7fb0" />
          <ellipse cx="0" cy="5" rx="9" ry="2" fill="#2fbf71" />
        </g>
      );
    case "hibiscus":
      return (
        <g>
          {ring(5, (d, i) => <path key={i} d="M0 0 C -7 -3, -7 -12, 0 -12 C 7 -12, 7 -3, 0 0Z" fill={i % 2 ? "#ff3d6e" : "#ff5a85"} transform={`rotate(${d})`} />)}
          <circle r="2.4" fill="#a3133c" />
          <path d="M0 0 L 5 -9" stroke="#ffd166" strokeWidth="1.2" />
          <circle cx="5" cy="-9" r="1.4" fill="#ffd166" />
        </g>
      );
  }
}

/** A single flower on a short stem, for the garden and the bloom reveal. */
export function FlowerPicture({ id, size = 64, faded = false }: { id: FlowerId; size?: number; faded?: boolean }) {
  return (
    <svg viewBox="-20 -20 40 46" width={size} height={size * 1.15} aria-hidden="true" className="overflow-visible">
      <g opacity={faded ? 0.18 : 1} style={faded ? { filter: "grayscale(1)" } : undefined}>
        <path d="M0 6 C -1 14, 1 18, 0 26" stroke="#2f9e44" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M0 18 c -6 -1 -10 -5 -10 -9 5 0 9 4 10 9z" fill="#86e05f" />
        <path d="M0 14 c 6 -1 9 -4 10 -8 -5 0 -9 3 -10 8z" fill="#3fca6e" />
        <FlowerHead id={id} />
      </g>
    </svg>
  );
}
