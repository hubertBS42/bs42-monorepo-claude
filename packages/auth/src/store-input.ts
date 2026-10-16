import sanitizeHtml from "sanitize-html"
import { APIError } from "better-auth/api"
import { OrganizationStatus } from "@workspace/db/enums"
import { isManagedFileUrl } from "@workspace/storage"

// Stores are created and updated through Better Auth's organization endpoints, which any store admin can call
// directly, so the organization hooks check the input here instead of trusting the console form.

// What the console's rich text editor (StarterKit, text alignment, tables) can produce, and nothing else
const POLICY_HTML: sanitizeHtml.IOptions = {
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

/** Policy HTML reduced to what the editor produces. An empty editor ("<p></p>") is stored as null. */
export function sanitizePolicy(value: unknown): string | null {
  if (typeof value !== "string") return null
  const html = sanitizeHtml(value, POLICY_HTML).trim()
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim()
  return text ? html : null
}

const MAX_NAME_LENGTH = 100
const STATUSES: readonly string[] = Object.values(OrganizationStatus)

/** Checks and cleans the store fields present in a create or update, leaving the rest as they are. */
export function checkStoreInput<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = { ...data }

  if (typeof data.name === "string") {
    const name = data.name.trim()
    if (name.length < 3 || name.length > MAX_NAME_LENGTH) throw new APIError("BAD_REQUEST", { message: `The store name must be 3 to ${MAX_NAME_LENGTH} characters.` })
    result.name = name
  }

  // Only blobs in our own container, so a logo can't point anywhere else. "" is how a store without one is created.
  if (typeof data.logo === "string" && data.logo !== "" && !isManagedFileUrl(data.logo)) {
    throw new APIError("BAD_REQUEST", { message: "The logo must be an image uploaded in the console." })
  }

  if ("status" in data && data.status !== undefined && !STATUSES.includes(String(data.status))) {
    throw new APIError("BAD_REQUEST", { message: "Invalid store status." })
  }

  for (const key of ["shippingPolicy", "returnsPolicy"] as const) {
    if (key in data) result[key] = sanitizePolicy(data[key])
  }

  return result as T
}
