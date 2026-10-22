"use client";

import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { Bold, Italic, Underline, Heading2, Heading3, List, ListOrdered, Quote, Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useYDoc, SaveIndicator } from "./use-ydoc";

function Tool({ on, label, pressed, children }: { on: () => void; label: string; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={on} aria-label={label} title={label} aria-pressed={pressed}
      className={cn("inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink [&_svg]:size-4", pressed && "bg-teal-soft text-teal-strong")}>
      {children}
    </button>
  );
}

/**
 * Shared document (spec §18A). Tiptap/ProseMirror bound to a Yjs XML
 * fragment, so simultaneous edits — even in the same paragraph — merge
 * character by character instead of overwriting each other.
 */
export function DocumentEditor({ artifactId, readOnly, label = "Shared document" }: { artifactId: string; readOnly?: boolean; label?: string }) {
  const { doc, status, loaded } = useYDoc(artifactId, { readOnly });
  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !readOnly,
      extensions: [
        StarterKit.configure({ undoRedo: false, link: false, code: false, codeBlock: false }),
        Collaboration.configure({ document: doc, field: "content" }),
      ],
      editorProps: {
        attributes: {
          class: "bloom-prose min-h-[18rem] px-5 py-4 text-[1.05rem] leading-relaxed",
          "aria-label": label,
          "aria-multiline": "true",
          role: "textbox",
        },
      },
    },
    [doc, readOnly],
  );

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => e ? ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"),
      h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }),
      ul: e.isActive("bulletList"), ol: e.isActive("orderedList"), quote: e.isActive("blockquote"),
    }) : null,
  });

  const empty = editor?.isEmpty ?? true;
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface px-2 py-1.5" role="toolbar" aria-label="Formatting">
        {!readOnly && editor ? (
          <>
            <Tool label="Bold" pressed={active?.bold} on={() => editor.chain().focus().toggleBold().run()}><Bold /></Tool>
            <Tool label="Italic" pressed={active?.italic} on={() => editor.chain().focus().toggleItalic().run()}><Italic /></Tool>
            <Tool label="Underline" pressed={active?.underline} on={() => editor.chain().focus().toggleUnderline().run()}><Underline /></Tool>
            <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
            <Tool label="Heading" pressed={active?.h2} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></Tool>
            <Tool label="Subheading" pressed={active?.h3} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 /></Tool>
            <Tool label="Bullet list" pressed={active?.ul} on={() => editor.chain().focus().toggleBulletList().run()}><List /></Tool>
            <Tool label="Numbered list" pressed={active?.ol} on={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></Tool>
            <Tool label="Quotation" pressed={active?.quote} on={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></Tool>
            <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
            <Tool label="Undo my last change" on={() => editor.chain().focus().undo().run()}><Undo2 /></Tool>
            <Tool label="Redo" on={() => editor.chain().focus().redo().run()}><Redo2 /></Tool>
          </>
        ) : null}
        <span className="ml-auto pr-2"><SaveIndicator status={readOnly ? "readonly" : status} /></span>
      </div>
      <div className="relative" data-testid="document-editor">
        {loaded && empty && !readOnly ? <p className="pointer-events-none absolute left-5 top-4 text-ink-faint" aria-hidden="true">Start writing together — everyone in your group can type here at the same time.</p> : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
