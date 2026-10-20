import { renderToReactElement } from "@tiptap/static-renderer/pm/react"
import { cn } from "@workspace/ui/lib/utils"

import { richTextExtensions } from "../rich-text-extensions"

// Rich text as saved (TipTap JSON, cleaned by sanitizeRichText), rendered to React elements with the editor's own
// extensions: no HTML string, so only the editor's tags come out. Works in server components. Saved text that isn't
// a document renders nothing.
export function RichTextContent({ value, className }: { value: string | null; className?: string }) {
  if (!value) return null
  let content: unknown
  try {
    content = JSON.parse(value)
  } catch {
    return null
  }
  if (typeof content !== "object" || content === null || (content as { type?: unknown }).type !== "doc") return null

  return <div className={cn("tiptap", className)}>{renderToReactElement({ content: content as Parameters<typeof renderToReactElement>[0]["content"], extensions: richTextExtensions })}</div>
}
