"use client"

import { useCallback, useEffect, useState } from "react"
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react"
import { Placeholder } from "@tiptap/extensions"
import { cn } from "@workspace/ui/lib/utils"
import MenuBar from "./menu-bar"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import { TableKit } from "@tiptap/extension-table"

interface RichTextEditorProps {
  onChange: (data: string | null) => void
  onBlur?: () => void
  onEditorInit?: (editor: Editor | null) => void
  value: string | null | undefined
  id: string
  disabled?: boolean
  placeholder?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

const emptyDoc: JSONContent = { type: "doc", content: [] }

function parseContent(value: string | null | undefined): JSONContent {
  if (!value) return emptyDoc
  try {
    return JSON.parse(value) as JSONContent
  } catch {
    // Legacy/plain-text content: wrap it as a single paragraph instead of
    // handing TipTap a bare string, which it cannot render as a document.
    return {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
    }
  }
}

const RichTextEditor = ({
  onChange,
  onBlur,
  onEditorInit,
  value,
  id,
  disabled = false,
  placeholder,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: RichTextEditorProps) => {
  const [isFocused, setIsFocused] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder,
      }),
      TableKit.configure({ table: { resizable: true } }),
    ],
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        ...(ariaInvalid ? { "aria-invalid": "true" } : {}),
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
        class: "min-h-[300px] p-4 focus:outline-none !w-full !max-w-none",
      },
    },
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? null : JSON.stringify(editor.getJSON()))
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => {
      setIsFocused(false)
      onBlur?.()
    },
    content: parseContent(value),
  })

  // Sync external value changes (e.g. form reset) into the editor.
  useEffect(() => {
    if (!editor) return

    const nextContent = parseContent(value)
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(nextContent)) {
      return
    }

    // The value came from outside, so it isn't an edit. TipTap 3 emits an update by default, which would call
    // onChange and mark the form dirty: the editor's JSON adds default attributes (textAlign: null) that a
    // stored document can leave out, so the comparison above fails even when nothing changed.
    editor.commands.setContent(nextContent, { emitUpdate: false })
  }, [value, editor])

  // Keep the editable state in sync when `disabled` changes after mount.
  // Without emitting an update: this runs on mount too, and an update calls onChange (see above).
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled, false)
  }, [disabled, editor])

  useEffect(() => {
    onEditorInit?.(editor ?? null)
    return () => onEditorInit?.(null)
  }, [editor, onEditorInit])

  useEffect(() => {
    return () => editor?.destroy()
  }, [editor])

  const handleFocus = useCallback(() => {
    if (editor && !disabled) editor.commands.focus()
  }, [editor, disabled])

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-md border transition-colors dark:bg-input/30",
        isFocused && "border-ring ring-3 ring-ring/50",
        disabled && "cursor-not-allowed opacity-50"
      )}
      onClick={handleFocus}
    >
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}

export default RichTextEditor
