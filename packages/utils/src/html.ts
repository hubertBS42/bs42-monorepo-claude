import sanitizeHtml from "sanitize-html"

// What the console's rich text editor (StarterKit, text alignment, tables) can produce, and nothing else
const RICH_TEXT_HTML: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "hr",
    "a",
    "table",
    "colgroup",
    "col",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    "*": ["style"],
    a: ["href", "target", "rel"],
    th: ["colspan", "rowspan", "colwidth"],
    td: ["colspan", "rowspan", "colwidth"],
    col: ["span"],
  },
  allowedStyles: {
    "*": { "text-align": [/^(left|center|right|justify)$/] },
    col: { width: [/^\d+(\.\d+)?(px|%)$/], "min-width": [/^\d+(\.\d+)?px$/] },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
  },
}

/** Rich text HTML reduced to what the editor produces. An empty editor ("<p></p>") is stored as null. */
export function sanitizeRichText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const html = sanitizeHtml(value, RICH_TEXT_HTML).trim()
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim()
  return text ? html : null
}
