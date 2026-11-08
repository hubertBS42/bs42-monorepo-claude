import { Prisma } from "../generated/prisma/client"
import { prisma } from "./client"

// Every text search ignores spaces and case, so "4 x 4" and "4x4" find each other. Prisma's `contains` can't compare
// with the spaces taken out, so these get the matching ids with SQL and the caller filters by them. Only the tables and
// columns listed here can be named: they go into the query as identifiers, and the search text only ever as a value.
type SearchableColumns = {
  blog_post: "title" | "excerpt"
  brand: "name"
  invitation: "email"
  order: "reference" | "customerName" | "customerEmail" | "customerPhone"
  organization: "name"
  product: "name" | "sku"
  purchase_order: "reference"
  quote: "reference" | "customerName" | "customerEmail" | "tradeCompanyName"
  review: "title"
  supplier: "name"
  trade_account: "companyName" | "registrationNumber" | "tin"
  user: "name" | "email" | "phone"
}

type Client = Pick<typeof prisma, "$queryRaw">

const identifier = (name: string) => Prisma.raw(`"${name}"`)

// A contains pattern for the text without its spaces, with LIKE's own characters taken literally
const toPattern = (search: string) => `%${search.replace(/\s/g, "").replace(/[\\%_]/g, "\\$&")}%`

// One column against the pattern. Null columns are simply no match
const columnMatches = (column: Prisma.Sql, pattern: string) => Prisma.sql`regexp_replace(${column}, '\\s', '', 'g') ILIKE ${pattern}`

// The ids of the rows where any of the columns contains any of the searches (a phone search adds its international form)
export async function idsMatching<T extends keyof SearchableColumns>(table: T, columns: readonly SearchableColumns[T][], search: string | readonly (string | null)[], client: Client = prisma): Promise<string[]> {
  const patterns = (typeof search === "string" ? [search] : search).filter((value): value is string => value !== null).map(toPattern)
  const matches = patterns.flatMap((pattern) => columns.map((column) => columnMatches(identifier(column), pattern)))
  const rows = await client.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM ${identifier(table)} WHERE ${Prisma.join(matches, " OR ")}`
  return rows.map((row) => row.id)
}

// The products whose name or SKU, or a variant's SKU, contains the search, and with `barcodes` their barcodes too
export async function productIdsMatching(search: string, { barcodes = false, client = prisma }: { barcodes?: boolean; client?: Client } = {}): Promise<string[]> {
  const pattern = toPattern(search)
  const column = (alias: "p" | "v", name: string) => columnMatches(Prisma.raw(`${alias}."${name}"`), pattern)
  const own = [column("p", "name"), column("p", "sku"), ...(barcodes ? [column("p", "barcode")] : [])]
  const variants = [column("v", "sku"), ...(barcodes ? [column("v", "barcode")] : [])]
  const rows = await client.$queryRaw<{ id: string }[]>`
    SELECT p.id::text AS id FROM product p
    WHERE ${Prisma.join(own, " OR ")}
      OR EXISTS (SELECT 1 FROM product_variant v WHERE v."productId" = p.id AND (${Prisma.join(variants, " OR ")}))`
  return rows.map((row) => row.id)
}
