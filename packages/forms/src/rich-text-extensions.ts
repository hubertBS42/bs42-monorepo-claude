import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import { TableKit } from "@tiptap/extension-table"

// What the rich text editor can produce, shared with the storefront's renderer (components/rich-text-content.tsx) so
// it renders exactly the editor's nodes and marks. sanitizeRichText (@workspace/utils/rich-text) keeps to the same set.
export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  TableKit.configure({ table: { resizable: true } }),
]
