// Turns a Prisma (or other) error into a short message for the user. Actions that need to react to a specific
// conflict should still match on the error code and return their own `code` (e.g. NAME_EXISTS).

interface DriverAdapterCause {
  constraint?: { index?: string; fields?: string[] }
  table?: string
}

interface KnownRequestError {
  name: string
  code?: string
  message?: string
  meta?: { target?: string | string[]; modelName?: string; driverAdapterError?: { cause?: DriverAdapterCause } }
}

const MESSAGES: Record<string, string> = {
  P2000: "A value is too long.",
  P2003: "This is linked to a record that is missing or still in use.",
  P2011: "A required value is missing.",
  P2012: "A required value is missing.",
  P2025: "The record was not found. It may have been deleted.",
}

// "parentId" -> "Parent id", "name" -> "Name"
const humanize = (field: string) => {
  const words = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The field a unique violation is about. Without a driver adapter Prisma puts it in meta.target. With the pg
 * adapter there's only the index name, e.g. "brand_name_key" or "category_parentId_name_key"; its last column is
 * the one people type (the name), so that's the one named.
 */
function getUniqueField(error: KnownRequestError): string | undefined {
  const target = error.meta?.target
  if (Array.isArray(target) && target.length > 0) return target[target.length - 1]
  if (typeof target === "string" && target) return target

  const cause = error.meta?.driverAdapterError?.cause
  const fields = cause?.constraint?.fields
  if (fields && fields.length > 0) return fields[fields.length - 1]

  const index = cause?.constraint?.index
  if (!index) return undefined
  const withoutTable = cause?.table && index.startsWith(`${cause.table}_`) ? index.slice(cause.table.length + 1) : index
  return (
    withoutTable
      .replace(/_(key|idx)$/, "")
      .split("_")
      .at(-1) || undefined
  )
}

// The last line of a Prisma message is the human-readable part; the lines before it describe the query
const lastLine = (message: string | undefined) =>
  message
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formatPrismaError = (error: any): string => {
  if (error?.name === "PrismaClientKnownRequestError") {
    const known = error as KnownRequestError
    if (known.code === "P2002") {
      const field = getUniqueField(known)
      return field ? `${humanize(field)} already exists.` : "This already exists."
    }
    if (known.code && MESSAGES[known.code]) return MESSAGES[known.code]!
    return lastLine(known.message) ?? "The database rejected the request."
  }

  // A query the code built wrongly. Its message dumps the whole query, which is no use to the user.
  if (error?.name === "PrismaClientValidationError") {
    console.error("Prisma validation error:", error)
    return "The request could not be processed."
  }

  if (typeof error?.message === "string") return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return "An unknown error occurred"
  }
}
