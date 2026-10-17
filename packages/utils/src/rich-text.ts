// The console's rich text editor (StarterKit with headings 1-3, text alignment, tables) saves its document as TipTap
// JSON. Clients can send any JSON, so it's rebuilt here from what that editor can produce: unknown nodes and marks are
// dropped, attributes are checked, and links keep only safe schemes. The storefront renders the result with TipTap's
// own renderer and the same extensions, so only known tags come out.

type JsonNode = { type: string; attrs?: Record<string, unknown>; content?: JsonNode[]; marks?: JsonMark[]; text?: string }
type JsonMark = { type: string; attrs?: Record<string, unknown> }
type Attrs = Record<string, unknown>

// Deeper than any real document (tables inside lists inside quotes stay well under it)
const MAX_DEPTH = 30

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

const oneOf =
  <T>(...allowed: T[]) =>
  (value: unknown): T | null =>
    allowed.includes(value as T) ? (value as T) : null

const intBetween = (min: number, max: number, fallback: number) => (value: unknown) => (Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : fallback)

const textAlign = oneOf("left", "center", "right", "justify")

// Attributes each node may keep; a node not listed here is dropped along with its content
const NODE_ATTRS: Record<string, (attrs: Attrs) => Attrs> = {
  doc: () => ({}),
  text: () => ({}),
  paragraph: (attrs) => ({ textAlign: textAlign(attrs.textAlign) }),
  heading: (attrs) => ({ textAlign: textAlign(attrs.textAlign), level: intBetween(1, 3, 1)(attrs.level) }),
  blockquote: () => ({}),
  bulletList: () => ({}),
  orderedList: (attrs) => ({ start: intBetween(1, 100_000, 1)(attrs.start), type: oneOf("1", "a", "A", "i", "I")(attrs.type) }),
  listItem: () => ({}),
  codeBlock: (attrs) => ({ language: typeof attrs.language === "string" && /^[\w+#-]{1,30}$/.test(attrs.language) ? attrs.language : null }),
  hardBreak: () => ({}),
  horizontalRule: () => ({}),
  table: () => ({}),
  tableRow: () => ({}),
  tableCell: (attrs) => cellAttrs(attrs),
  tableHeader: (attrs) => cellAttrs(attrs),
}

function cellAttrs(attrs: Attrs): Attrs {
  const colwidth = Array.isArray(attrs.colwidth) && attrs.colwidth.every((width) => Number.isInteger(width) && width > 0 && width <= 10_000) ? attrs.colwidth : null
  return { colspan: intBetween(1, 100, 1)(attrs.colspan), rowspan: intBetween(1, 100, 1)(attrs.rowspan), colwidth, align: oneOf("left", "center", "right")(attrs.align) }
}

function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(value).protocol) ? value : null
  } catch {
    return null
  }
}

// Marks each text may keep; a mark returning null is dropped and its text kept
const MARK_ATTRS: Record<string, (attrs: Attrs) => Attrs | null> = {
  bold: () => ({}),
  italic: () => ({}),
  underline: () => ({}),
  strike: () => ({}),
  code: () => ({}),
  link: (attrs) => {
    const href = safeHref(attrs.href)
    if (!href) return null
    const title = typeof attrs.title === "string" ? attrs.title.slice(0, 200) : null
    return { href, target: "_blank", rel: "noopener noreferrer nofollow", class: null, title }
  },
}

function cleanMarks(marks: unknown): JsonMark[] | undefined {
  if (!Array.isArray(marks)) return undefined
  const cleaned = marks.flatMap((mark): JsonMark[] => {
    if (!isRecord(mark) || typeof mark.type !== "string") return []
    const clean = MARK_ATTRS[mark.type]
    const attrs = clean?.(isRecord(mark.attrs) ? mark.attrs : {})
    if (!attrs) return []
    return [Object.keys(attrs).length ? { type: mark.type, attrs } : { type: mark.type }]
  })
  return cleaned.length ? cleaned : undefined
}

function cleanNode(node: unknown, depth: number): JsonNode | null {
  if (!isRecord(node) || typeof node.type !== "string" || depth > MAX_DEPTH) return null
  const clean = NODE_ATTRS[node.type]
  if (!clean) return null

  if (node.type === "text") {
    if (typeof node.text !== "string" || node.text === "") return null
    const marks = cleanMarks(node.marks)
    return marks ? { type: "text", text: node.text, marks } : { type: "text", text: node.text }
  }

  const result: JsonNode = { type: node.type }
  const attrs = clean(isRecord(node.attrs) ? node.attrs : {})
  if (Object.keys(attrs).length) result.attrs = attrs
  if (Array.isArray(node.content)) {
    const content = node.content.map((child) => cleanNode(child, depth + 1)).filter((child): child is JsonNode => child !== null)
    if (content.length) result.content = content
  }
  return result
}

// What the editor counts as empty: no text, and nothing like a rule or table that shows without any
const hasContent = (node: JsonNode): boolean => (node.type === "text" ? !!node.text?.trim() : node.type === "horizontalRule" || node.type === "table" || !!node.content?.some(hasContent))

/**
 * Editor JSON rebuilt from what the editor can produce, as a string ready to store. An empty document is null.
 * Text that isn't JSON becomes a single paragraph, as the editor itself shows it.
 */
export function sanitizeRichText(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    parsed = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] }
  }

  if (!isRecord(parsed) || parsed.type !== "doc") return null
  const doc = cleanNode(parsed, 0)
  return doc && hasContent(doc) ? JSON.stringify(doc) : null
}
