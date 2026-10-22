"use client";

import { useCallback, useState } from "react";
import { Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useWorkspace } from "./context";

export function useUploadImage() {
  const { sessionId, refresh } = useWorkspace();
  const toast = useToast();
  return useCallback(async (file: File, caption = ""): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("caption", caption);
    try {
      const res = await fetch(`/api/live/student/${sessionId}/media`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Upload failed.");
      refresh();
      return data.id as string;
    } catch (e) {
      toast({ title: "Upload didn't work", body: `${(e as Error).message} Nothing else was affected — you can try again.`, tone: "coral" });
      return null;
    }
  }, [sessionId, refresh, toast]);
}

/** Photos of physical work (spec §18). Uploads are private to the group and teacher. */
export function MediaUploader({ title = "Photos of your work" }: { title?: string }) {
  const { group } = useWorkspace();
  const upload = useUploadImage();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby="media-title">
      <h2 id="media-title" className="flex items-center gap-2 font-semibold"><Camera className="size-5 text-teal" aria-hidden="true" />{title}</h2>
      {group.media.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {group.media.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/${m.id}`} alt={m.caption || "Photo of the group's work"} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              {m.caption ? <p className="px-2 py-1 text-xs">{m.caption}</p> : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-ink-muted">No photos yet.</p>}
      <form className="flex flex-col gap-2" onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true);
        if (await upload(file, caption)) { setFile(null); setCaption(""); (e.target as HTMLFormElement).reset(); }
        setBusy(false);
      }}>
        <label htmlFor="photo" className="text-sm font-semibold">Take or choose a photo</label>
        <input id="photo" type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-soft file:px-3 file:py-2 file:font-semibold file:text-teal-strong" />
        <label htmlFor="photo-caption" className="text-sm font-semibold">Caption <span className="font-normal text-ink-muted">(helps everyone, including screen-reader users)</span></label>
        <Input id="photo-caption" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="e.g. Test 2: 4.2 metres" />
        <Button type="submit" size="sm" className="self-end" disabled={!file} pending={busy}><Upload />Upload</Button>
      </form>
      {!group.media.length ? <Notice>Photos stay within your group and your teacher unless your work is presented to the class.</Notice> : null}
    </section>
  );
}
