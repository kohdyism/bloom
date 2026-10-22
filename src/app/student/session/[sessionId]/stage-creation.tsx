"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Presentation, Shapes, Camera, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlay";
import { DocumentEditor } from "@/components/collab/document-editor";
import { Whiteboard } from "@/components/collab/whiteboard";
import { SlidesEditor } from "@/components/collab/slides";
import { useWorkspace } from "./context";
import { MediaUploader, useUploadImage } from "./media";

const META = {
  document: { label: "Document", target: "document", icon: FileText },
  whiteboard: { label: "Whiteboard", target: "whiteboard", icon: Shapes },
  slides: { label: "Slides", target: "slide", icon: Presentation },
} as const;
type Kind = keyof typeof META;

/** Collaborative creation (spec §18): only the workspaces the teacher enabled. */
export function Creation() {
  const { group, state, setInserter } = useWorkspace();
  const upload = useUploadImage();
  const kinds = (group.stage?.config.artifacts ?? []).filter((k) => group.artifacts.some((a) => a.kind === k)) as Kind[];
  const [tab, setTab] = useState<string>(kinds[0] ?? "photos");
  const ended = state.session.status === "ended";
  const artifactId = (k: string) => group.artifacts.find((a) => a.kind === k)!.id;

  // Each editor hands us an "insert" function; the idea bank uses the one for the visible tab.
  const [fns, setFns] = useState<Partial<Record<Kind, ((t: string) => void) | null>>>({});
  const register = useMemo(() => {
    const make = (k: Kind) => (fn: ((t: string) => void) | null) => setFns((prev) => (prev[k] === fn ? prev : { ...prev, [k]: fn }));
    return { document: make("document"), whiteboard: make("whiteboard"), slides: make("slides") };
  }, []);
  useEffect(() => {
    const k = tab as Kind;
    const fn = fns[k];
    setInserter(fn && META[k] ? { label: META[k].target, insert: fn } : null);
  }, [fns, tab, setInserter]);
  useEffect(() => () => setInserter(null), [setInserter]);

  if (!kinds.length) return <MediaUploader />;
  return (
    <div className="flex min-h-[28rem] flex-1 flex-col gap-2">
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList aria-label="Shared workspaces" className="bg-purple-soft/70">
            {kinds.map((k) => { const Icon = META[k].icon; return <TabsTrigger key={k} value={k}><Icon aria-hidden="true" />{META[k].label}</TabsTrigger>; })}
            <TabsTrigger value="photos"><Camera aria-hidden="true" />Photos</TabsTrigger>
          </TabsList>
          <p className="ml-auto inline-flex items-center gap-1.5 text-sm text-ink-muted"><Users className="size-4" aria-hidden="true" />Everyone can edit at once — it saves by itself.</p>
        </div>
        {kinds.map((k) => (
          <TabsContent key={k} value={k} className="mt-2 flex min-h-0 flex-1 flex-col" forceMount hidden={tab !== k}>
            {k === "document" ? <DocumentEditor artifactId={artifactId(k)} readOnly={ended} onInserter={register.document} className="min-h-[26rem] flex-1" /> : null}
            {k === "whiteboard" ? <Whiteboard artifactId={artifactId(k)} readOnly={ended} uploadImage={upload} onInserter={register.whiteboard} /> : null}
            {k === "slides" ? <SlidesEditor artifactId={artifactId(k)} readOnly={ended} uploadImage={upload} onInserter={register.slides} /> : null}
          </TabsContent>
        ))}
        <TabsContent value="photos" className="mt-2"><MediaUploader /></TabsContent>
      </Tabs>
    </div>
  );
}
