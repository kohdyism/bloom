"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { ArrowUpRight, Circle, ImagePlus, MousePointer2, PenLine, Redo2, Square, StickyNote, Trash2, Type, Undo2, BringToFront } from "lucide-react";
import { BOARD_COLORS, makeObjectMap, readObjects, type BoardObject, type ObjectType } from "@/lib/domain/artifact-model";
import { BoardObjectShape, colorValue } from "@/components/board/board-object";
import { cn } from "@/lib/utils";

type Tool = "select" | "sticky" | "text" | "rect" | "ellipse" | "arrow" | "path";
const LOCAL = "local-edit";
const newId = () => Math.random().toString(36).slice(2, 10);

/** Subscribe React to a Y.Map of objects (deep). */
function useObjects(map: Y.Map<Y.Map<unknown>>) {
  const cache = useRef<{ v: number; objs: BoardObject[] }>({ v: -1, objs: [] });
  const version = useRef(0);
  const subscribe = useCallback((cb: () => void) => {
    const h = () => { version.current++; cb(); };
    map.observeDeep(h);
    return () => map.unobserveDeep(h);
  }, [map]);
  const get = useCallback(() => {
    if (cache.current.v !== version.current) cache.current = { v: version.current, objs: readObjects(map) };
    return cache.current.objs;
  }, [map]);
  return useSyncExternalStore(subscribe, get, get);
}

export function BoardCanvas({
  doc, map, width, height, readOnly, mediaUrl, uploadImage, label, background = "grid",
}: {
  doc: Y.Doc; map: Y.Map<Y.Map<unknown>>; width: number; height: number; readOnly?: boolean; mediaUrl: (id: string) => string;
  uploadImage?: (file: File) => Promise<string | null>; label: string; background?: "grid" | "white";
}) {
  const objects = useObjects(map);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState<keyof typeof BOARD_COLORS>("yellow");
  const [selected, setSelected] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [draftPath, setDraftPath] = useState<{ x: number; y: number }[] | null>(null);
  const drag = useRef<{ mode: "move" | "resize" | "create" | "arrow-end"; id: string; startX: number; startY: number; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const undo = useMemo(() => new Y.UndoManager(map, { trackedOrigins: new Set([LOCAL]), captureTimeout: 400 }), [map]);
  useEffect(() => () => undo.destroy(), [undo]);

  const tx = useCallback((fn: () => void) => doc.transact(fn, LOCAL), [doc]);
  const setProps = useCallback((id: string, props: Partial<BoardObject>) => {
    const m = map.get(id);
    if (!m) return;
    tx(() => { for (const [k, v] of Object.entries(props)) m.set(k, v); });
  }, [map, tx]);
  const maxZ = () => objects.reduce((a, o) => Math.max(a, o.z), 0);

  const toPoint = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.round(p.x), y: Math.round(p.y) };
  };

  const add = (o: Omit<BoardObject, "id" | "z">) => {
    const id = newId();
    tx(() => map.set(id, makeObjectMap({ ...o, id, z: maxZ() + 1 })));
    return id;
  };

  const textColor = (c: string) => (["yellow", "mint", "sky", "lilac", "peach", "white"].includes(c) ? "ink" : c);

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    const p = toPoint(e);
    setEditingText(null);
    if (tool === "select") { setSelected(null); return; }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (tool === "sticky") {
      const id = add({ type: "sticky", x: p.x - 100, y: p.y - 80, w: 200, h: 160, color, text: "", fontSize: 24 });
      setSelected(id); setEditingText(id); setTool("select");
    } else if (tool === "text") {
      const id = add({ type: "text", x: p.x, y: p.y - 20, w: 320, h: 70, color: textColor(color), text: "", fontSize: 32 });
      setSelected(id); setEditingText(id); setTool("select");
    } else if (tool === "rect" || tool === "ellipse") {
      const id = add({ type: tool, x: p.x, y: p.y, w: 10, h: 10, color, text: "" });
      drag.current = { mode: "create", id, startX: p.x, startY: p.y, ox: p.x, oy: p.y, ow: 10, oh: 10 };
      setSelected(id);
    } else if (tool === "arrow") {
      const id = add({ type: "arrow", x: p.x, y: p.y, w: 0, h: 0, x2: p.x + 1, y2: p.y + 1, color: textColor(color) });
      drag.current = { mode: "arrow-end", id, startX: p.x, startY: p.y, ox: 0, oy: 0, ow: 0, oh: 0 };
      setSelected(id);
    } else if (tool === "path") {
      setDraftPath([p]);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const p = toPoint(e);
    if (draftPath) { setDraftPath((d) => (d ? [...d, p] : d)); return; }
    const d = drag.current;
    if (!d) return;
    if (d.mode === "move") setProps(d.id, { x: d.ox + (p.x - d.startX), y: d.oy + (p.y - d.startY) });
    else if (d.mode === "resize") setProps(d.id, { w: Math.max(40, d.ow + (p.x - d.startX)), h: Math.max(30, d.oh + (p.y - d.startY)) });
    else if (d.mode === "create") setProps(d.id, { x: Math.min(p.x, d.startX), y: Math.min(p.y, d.startY), w: Math.max(10, Math.abs(p.x - d.startX)), h: Math.max(10, Math.abs(p.y - d.startY)) });
    else if (d.mode === "arrow-end") setProps(d.id, { x2: p.x, y2: p.y });
  };

  const onUp = () => {
    if (draftPath && draftPath.length > 1) {
      const xs = draftPath.map((q) => q.x);
      const ys = draftPath.map((q) => q.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      add({ type: "path", x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY, color: textColor(color), points: draftPath.map((q) => `${q.x - minX},${q.y - minY}`).join(" "), fontSize: 5 });
    }
    setDraftPath(null);
    if (drag.current?.mode === "create" || drag.current?.mode === "arrow-end") setTool("select");
    drag.current = null;
  };

  const onObjectDown = (e: React.PointerEvent, o: BoardObject, mode: "move" | "resize" | "arrow-end" = "move") => {
    if (readOnly || tool !== "select") return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toPoint(e);
    setSelected(o.id);
    drag.current = { mode, id: o.id, startX: p.x, startY: p.y, ox: o.x, oy: o.y, ow: o.w, oh: o.h };
  };

  const remove = (id: string) => { tx(() => map.delete(id)); setSelected(null); setEditingText(null); };

  const onObjectKey = (e: React.KeyboardEvent, o: BoardObject) => {
    if (readOnly) return;
    const step = e.shiftKey ? 50 : 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); setProps(o.id, { x: o.x + moves[e.key][0], y: o.y + moves[e.key][1], ...(o.type === "arrow" ? { x2: (o.x2 ?? 0) + moves[e.key][0], y2: (o.y2 ?? 0) + moves[e.key][1] } : {}) }); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(o.id); }
    else if (e.key === "Enter" && ["sticky", "text", "rect", "ellipse"].includes(o.type)) { e.preventDefault(); setEditingText(o.id); }
    else if (e.key === "Escape") { setSelected(null); (e.target as HTMLElement).blur(); }
  };

  // Global undo/redo shortcuts while the canvas has focus.
  const onCanvasKey = (e: React.KeyboardEvent) => {
    if (readOnly || editingText) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) undo.redo(); else undo.undo(); }
  };

  const sel = objects.find((o) => o.id === selected) ?? null;
  const editingObj = objects.find((o) => o.id === editingText) ?? null;

  const tools: { t: Tool; label: string; icon: React.ElementType }[] = [
    { t: "select", label: "Select and move", icon: MousePointer2 },
    { t: "sticky", label: "Sticky note", icon: StickyNote },
    { t: "text", label: "Text", icon: Type },
    { t: "rect", label: "Rectangle", icon: Square },
    { t: "ellipse", label: "Circle", icon: Circle },
    { t: "arrow", label: "Arrow (link two things)", icon: ArrowUpRight },
    { t: "path", label: "Draw freehand", icon: PenLine },
  ];

  const describe = (o: BoardObject) => `${{ sticky: "Sticky note", text: "Text", rect: "Rectangle", ellipse: "Circle", arrow: "Arrow", path: "Drawing", image: "Image" }[o.type as ObjectType]}${o.text ? `: ${o.text}` : ""}`;

  return (
    <div className="flex flex-col gap-2" onKeyDown={onCanvasKey}>
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1.5" role="toolbar" aria-label={`${label} tools`}>
          {tools.map(({ t, label: l, icon: Icon }) => (
            <button key={t} type="button" aria-pressed={tool === t} title={l} aria-label={l} onClick={() => setTool(t)} className={cn("inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 [&_svg]:size-4", tool === t && "bg-teal-soft text-teal-strong")}><Icon /></button>
          ))}
          {uploadImage ? (
            <label className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]" title="Insert image">
              <ImagePlus className="size-4" aria-hidden="true" />
              <span className="sr-only">Insert image</span>
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const mediaId = await uploadImage(f);
                if (mediaId) { const id = add({ type: "image", x: width / 2 - 240, y: height / 2 - 180, w: 480, h: 360, color: "white", mediaId }); setSelected(id); }
              }} />
            </label>
          ) : null}
          <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Colour">
            {(Object.keys(BOARD_COLORS) as (keyof typeof BOARD_COLORS)[]).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} title={c}
                onClick={() => { setColor(c); if (sel) setProps(sel.id, { color: sel.type === "sticky" || sel.type === "rect" || sel.type === "ellipse" ? c : textColor(c) }); }}
                className={cn("size-6 rounded-full border border-line-strong", color === c && "ring-2 ring-teal ring-offset-1")} style={{ background: colorValue(c) }} />
            ))}
          </div>
          <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
          <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2" aria-label="Undo my last change" title="Undo (Ctrl+Z)" onClick={() => undo.undo()}><Undo2 className="size-4" /></button>
          <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2" aria-label="Redo" title="Redo" onClick={() => undo.redo()}><Redo2 className="size-4" /></button>
          {sel ? (
            <>
              <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2" aria-label="Bring to front" title="Bring to front" onClick={() => setProps(sel.id, { z: maxZ() + 1 })}><BringToFront className="size-4" /></button>
              <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg text-coral hover:bg-coral-soft" aria-label="Delete selected" title="Delete" onClick={() => remove(sel.id)}><Trash2 className="size-4" /></button>
            </>
          ) : null}
        </div>
      ) : null}
      <div className={cn("relative overflow-hidden rounded-2xl border border-line", background === "grid" ? "bg-white bg-[radial-gradient(var(--line)_1px,transparent_1px)] bg-[length:24px_24px]" : "bg-white")}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className={cn("block h-auto w-full touch-none select-none", tool !== "select" && !readOnly && "cursor-crosshair")}
          role="application"
          aria-label={`${label}. ${readOnly ? "Read only." : "Use the toolbar to add items. Tab to an item, then use arrow keys to move it, Enter to edit text, Delete to remove."}`}
          onPointerDown={onBackgroundDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <rect x="0" y="0" width={width} height={height} fill="transparent" />
          {objects.map((o) => (
            <g
              key={o.id}
              tabIndex={readOnly ? -1 : 0}
              role="button"
              aria-label={describe(o)}
              aria-pressed={selected === o.id}
              onPointerDown={(e) => onObjectDown(e, o)}
              onDoubleClick={() => !readOnly && ["sticky", "text", "rect", "ellipse"].includes(o.type) && setEditingText(o.id)}
              onFocus={() => setSelected(o.id)}
              onKeyDown={(e) => onObjectKey(e, o)}
              className={cn(!readOnly && tool === "select" && "cursor-move", "outline-none")}
            >
              <BoardObjectShape o={o} mediaUrl={mediaUrl} editing={editingText === o.id} />
              {selected === o.id && !readOnly ? (
                o.type === "arrow" ? (
                  <circle cx={o.x2} cy={o.y2} r="12" fill="var(--teal)" stroke="white" strokeWidth="3" className="cursor-nwse-resize" onPointerDown={(e) => onObjectDown(e, o, "arrow-end")} />
                ) : (
                  <>
                    <rect x={o.x - 6} y={o.y - 6} width={o.w + 12} height={o.h + 12} fill="none" stroke="var(--teal)" strokeWidth="3" strokeDasharray="8 6" rx="8" pointerEvents="none" />
                    <rect x={o.x + o.w - 4} y={o.y + o.h - 4} width="22" height="22" rx="5" fill="var(--teal)" stroke="white" strokeWidth="3" className="cursor-nwse-resize" onPointerDown={(e) => onObjectDown(e, o, "resize")} aria-hidden="true" />
                  </>
                )
              ) : null}
            </g>
          ))}
          {draftPath ? <polyline points={draftPath.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={colorValue(textColor(color))} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {editingObj ? (
            <foreignObject x={editingObj.x} y={editingObj.y} width={Math.max(120, editingObj.w)} height={Math.max(60, editingObj.h)}>
              <TextEditor
                initial={editingObj.text ?? ""}
                fontSize={editingObj.fontSize ?? 24}
                onCommit={(text) => { setProps(editingObj.id, { text }); setEditingText(null); }}
              />
            </foreignObject>
          ) : null}
        </svg>
        {objects.length === 0 && !readOnly ? <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-ink-faint">Pick a tool above, then tap the board to add something.</p> : null}
      </div>
    </div>
  );
}

function TextEditor({ initial, fontSize, onCommit }: { initial: string; fontSize: number; onCommit: (t: string) => void }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <textarea
      ref={ref}
      aria-label="Edit text"
      value={value}
      onChange={(e) => setValue(e.target.value.slice(0, 600))}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) onCommit(value); }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ fontSize, width: "100%", height: "100%", padding: 12, resize: "none", background: "rgb(255 255 255 / 0.9)", border: "3px solid var(--teal)", borderRadius: 8, fontFamily: "var(--font-sans)", lineHeight: 1.25 }}
    />
  );
}
