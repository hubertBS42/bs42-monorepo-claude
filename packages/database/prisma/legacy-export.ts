// Exports the old bs42.net system's records (portal.bs42.net, the old admin) for legacy-import.ts: orders, quotations,
// suppliers, inventory orders, stock levels and staff users, plus the old catalogue's product ids and slugs, one JSON
// file each. Read only: it only sends GET requests to the old system's list endpoints.
//
//   pnpm --filter @workspace/db db:legacy:export --out <folder>
//
// Run it on launch day once the old system has stopped taking orders, so nothing made after it is missed. The files
// hold customers' names, emails, phones and addresses: keep the folder out of the repository. Staff users' password
// hashes are left out.
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const PORTAL = "https://portal.bs42.net/api"
const STOREFRONT = "https://bs42.net/api"
const PAGE_SIZE = 100

// Route on the old portal → the key its list response keeps the rows under
const COLLECTIONS: Record<string, string> = {
  orders: "orders",
  quotations: "quotations",
  suppliers: "suppliers",
  "inventory-orders": "inventoryOrders",
  stockLevels: "limitedStockLevels",
  users: "users",
}

function outFolder() {
  const at = process.argv.indexOf("--out")
  const folder = at === -1 ? undefined : process.argv[at + 1]
  if (!folder || folder.startsWith("--")) throw new Error("Name the folder to write to: --out <folder>")
  return path.resolve(folder)
}

async function getJson(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return (await response.json()) as { data?: Record<string, unknown> }
}

async function exportCollection(route: string, key: string) {
  const rows: Record<string, unknown>[] = []
  let count: number | null = null
  for (let page = 1; ; page++) {
    const { data = {} } = await getJson(`${PORTAL}/${route}?limit=${PAGE_SIZE}&page=${page}`)
    const pageRows = (data[key] ?? []) as Record<string, unknown>[]
    if (typeof data.count === "number") count = data.count
    rows.push(...pageRows)
    if (pageRows.length < PAGE_SIZE) break
  }
  if (count !== null && rows.length !== count) throw new Error(`${route}: got ${rows.length} of the ${count} the old system reports`)
  return rows
}

async function main() {
  const folder = outFolder()
  await mkdir(folder, { recursive: true })

  for (const [route, key] of Object.entries(COLLECTIONS)) {
    const rows = await exportCollection(route, key)
    if (route === "users") for (const user of rows) delete user.password
    await writeFile(path.join(folder, `${route}.json`), JSON.stringify(rows, null, 1))
    console.log(`${route}: ${rows.length}`)
  }

  // The old catalogue, for its product ids: order lines name products by id, the new catalogue by old slug
  const { data = {} } = await getJson(`${STOREFRONT}/products?limit=1000`)
  const products = ((data.products ?? []) as { _id: string; slug: string; title: string }[]).map(({ _id, slug, title }) => ({ _id, slug, title }))
  await writeFile(path.join(folder, "products.json"), JSON.stringify(products, null, 1))
  console.log(`products: ${products.length}`)
  console.log(`Written to ${folder}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
