"use client";

import * as Y from "yjs";
import { BoardCanvas, type InsertText } from "./board-canvas";
import { useYDoc, SaveIndicator } from "./use-ydoc";

export function Whiteboard({ artifactId, readOnly, uploadImage, onInserter }: { artifactId: string; readOnly?: boolean; uploadImage?: (f: File) => Promise<string | null>; onInserter?: (f: InsertText | null) => void }) {
  const { doc, status } = useYDoc(artifactId, { readOnly });
  const map = doc.getMap("objects") as Y.Map<Y.Map<unknown>>;
  return (
    <div className="flex flex-col gap-1.5" data-testid="whiteboard">
      <div className="flex justify-end"><SaveIndicator status={readOnly ? "readonly" : status} /></div>
      <BoardCanvas doc={doc} map={map} width={2000} height={1250} readOnly={readOnly || status === "readonly"} mediaUrl={(id) => `/api/media/${id}`} uploadImage={uploadImage} label="Group whiteboard" onInserter={onInserter} />
    </div>
  );
}
