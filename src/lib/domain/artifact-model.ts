import * as Y from "yjs";

/**
 * Shared object model for whiteboards and slides (one engine, spec §18).
 * Stored in Yjs so concurrent edits merge without overwriting.
 *
 *   whiteboard doc: Y.Map "objects"  (id -> Y.Map<BoardObject fields>)
 *   slides doc:     Y.Array "slides" (Y.Map { id, layout, objects: Y.Map })
 *   document doc:   Y.XmlFragment "content" (Tiptap / ProseMirror)
 */
export type ObjectType = "sticky" | "text" | "rect" | "ellipse" | "arrow" | "path" | "image";

export type BoardObject = {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  text?: string;
  fontSize?: number;
  /** arrow: end point; path: flattened "x,y x,y" */
  x2?: number;
  y2?: number;
  points?: string;
  mediaId?: string;
  z: number;
};

export type SlideData = { id: string; layout: SlideLayout; objects: BoardObject[] };
export type SlideLayout = "title" | "title_body" | "two_column" | "image_caption" | "blank";

export const BOARD_COLORS = {
  yellow: "#fdf0b8",
  mint: "#cdeedc",
  sky: "#d5e4fb",
  lilac: "#e3dafa",
  peach: "#fcdccd",
  white: "#ffffff",
  ink: "#1b2430",
  teal: "#0e6f67",
  blue: "#2b58c4",
  purple: "#6346b8",
  coral: "#b9420f",
} as const;
export type BoardColor = keyof typeof BOARD_COLORS;

export const SLIDE_W = 1600;
export const SLIDE_H = 900;

export function readObjects(map: Y.Map<Y.Map<unknown>>): BoardObject[] {
  const out: BoardObject[] = [];
  map.forEach((m, id) => {
    const o = m.toJSON() as BoardObject;
    if (o && typeof o.x === "number") out.push({ ...o, id });
  });
  return out.sort((a, b) => a.z - b.z);
}

/**
 * Slides are ordered by a fractional `order` field rather than array
 * position, so reordering never deletes/re-creates a slide (which could drop
 * a groupmate's concurrent edits to it).
 */
export function readSlides(arr: Y.Array<Y.Map<unknown>>): (SlideData & { index: number; order: number })[] {
  return arr
    .toArray()
    .map((s, index) => {
      const objs = s.get("objects") as Y.Map<Y.Map<unknown>> | undefined;
      const order = typeof s.get("order") === "number" ? (s.get("order") as number) : index;
      return { id: String(s.get("id")), layout: (s.get("layout") as SlideLayout) ?? "blank", objects: objs ? readObjects(objs) : [], index, order };
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function makeObjectMap(o: BoardObject): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(o)) if (k !== "id" && v !== undefined) m.set(k, v);
  return m;
}

/** Starter content for a new slide of a given layout (frame 1600×900). */
export function layoutObjects(layout: SlideLayout, idGen: () => string): BoardObject[] {
  const t = (y: number, h: number, text: string, fontSize: number, x = 120, w = 1360): BoardObject => ({ id: idGen(), type: "text", x, y, w, h, color: "ink", text, fontSize, z: 1 });
  switch (layout) {
    case "title":
      return [t(320, 160, "Title", 96), t(500, 90, "Subtitle", 44)];
    case "title_body":
      return [t(80, 130, "Slide title", 72), t(250, 560, "• Your first point\n• Your second point", 44)];
    case "two_column":
      return [t(80, 130, "Slide title", 72), t(250, 560, "Left side", 40, 120, 640), t(250, 560, "Right side", 40, 840, 640)];
    case "image_caption":
      return [t(80, 130, "Slide title", 72), { id: idGen(), type: "rect", x: 120, y: 240, w: 900, h: 560, color: "sky", z: 0, text: "Add an image" }, t(260, 520, "Caption", 40, 1080, 400)];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Document → safe HTML (server-side, escaped). Never trusts client HTML.
// ---------------------------------------------------------------------------
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Delta = { insert: unknown; attributes?: Record<string, unknown> };

function renderText(t: Y.XmlText): string {
  return (t.toDelta() as Delta[])
    .map((d) => {
      if (typeof d.insert !== "string") return "";
      let s = escapeHtml(d.insert);
      const a = d.attributes ?? {};
      if (a.bold) s = `<strong>${s}</strong>`;
      if (a.italic) s = `<em>${s}</em>`;
      if (a.underline) s = `<u>${s}</u>`;
      if (a.strike) s = `<s>${s}</s>`;
      return s;
    })
    .join("");
}

function renderNode(n: Y.XmlElement | Y.XmlText): string {
  if (n instanceof Y.XmlText) return renderText(n);
  const inner = n.toArray().map((c) => renderNode(c as Y.XmlElement | Y.XmlText)).join("");
  switch (n.nodeName) {
    case "paragraph": return `<p>${inner}</p>`;
    case "heading": {
      const level = Math.min(3, Math.max(2, Number(n.getAttribute("level")) || 2));
      return `<h${level}>${inner}</h${level}>`;
    }
    case "bulletList": return `<ul>${inner}</ul>`;
    case "orderedList": return `<ol>${inner}</ol>`;
    case "listItem": return `<li>${inner}</li>`;
    case "blockquote": return `<blockquote>${inner}</blockquote>`;
    case "hardBreak": return "<br>";
    case "horizontalRule": return "<hr>";
    default: return inner;
  }
}

export function documentToHtml(doc: Y.Doc): string {
  const frag = doc.getXmlFragment("content");
  return frag.toArray().map((n) => renderNode(n as Y.XmlElement | Y.XmlText)).join("");
}

export function documentToText(doc: Y.Doc): string {
  const walk = (n: Y.XmlElement | Y.XmlText): string =>
    n instanceof Y.XmlText ? n.toString() : n.toArray().map((c) => walk(c as Y.XmlElement | Y.XmlText)).join("") + (["paragraph", "heading", "listItem"].includes(n.nodeName) ? "\n" : "");
  return doc.getXmlFragment("content").toArray().map((n) => walk(n as Y.XmlElement | Y.XmlText)).join("").trim();
}
