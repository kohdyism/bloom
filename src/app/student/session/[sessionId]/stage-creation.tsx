"use client";

import { useState } from "react";
import { FileText, Presentation, Shapes, Camera } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlay";
import { DocumentEditor } from "@/components/collab/document-editor";
import { Whiteboard } from "@/components/collab/whiteboard";
import { SlidesEditor } from "@/components/collab/slides";
import { Notice } from "@/components/ui/primitives";
import { useWorkspace } from "./context";
import { MediaUploader, useUploadImage } from "./media";

const META = {
  document: { label: "Document", icon: FileText },
  whiteboard: { label: "Whiteboard", icon: Shapes },
  slides: { label: "Slides", icon: Presentation },
} as const;

/** Collaborative creation (spec §18): only the workspaces the teacher enabled. */
export function Creation() {
  const { group, state } = useWorkspace();
  const upload = useUploadImage();
  const kinds = (group.stage?.config.artifacts ?? []).filter((k) => group.artifacts.some((a) => a.kind === k));
  const [tab, setTab] = useState<string>(kinds[0] ?? "photos");
  const ended = state.session.status === "ended";
  const artifactId = (k: string) => group.artifacts.find((a) => a.kind === k)!.id;
  if (!kinds.length) return <MediaUploader />;
  return (
    <div className="flex flex-col gap-3">
      <Notice>Everyone in your group can edit at the same time. Changes save automatically and nothing gets overwritten.</Notice>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Shared workspaces">
          {kinds.map((k) => { const Icon = META[k].icon; return <TabsTrigger key={k} value={k}><Icon aria-hidden="true" />{META[k].label}</TabsTrigger>; })}
          <TabsTrigger value="photos"><Camera aria-hidden="true" />Photos</TabsTrigger>
        </TabsList>
        {kinds.map((k) => (
          <TabsContent key={k} value={k} className="mt-3" forceMount hidden={tab !== k}>
            {k === "document" ? <DocumentEditor artifactId={artifactId(k)} readOnly={ended} /> : null}
            {k === "whiteboard" ? <Whiteboard artifactId={artifactId(k)} readOnly={ended} uploadImage={upload} /> : null}
            {k === "slides" ? <SlidesEditor artifactId={artifactId(k)} readOnly={ended} uploadImage={upload} /> : null}
          </TabsContent>
        ))}
        <TabsContent value="photos" className="mt-3"><MediaUploader /></TabsContent>
      </Tabs>
    </div>
  );
}
