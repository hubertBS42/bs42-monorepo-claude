// Works the estimated costs of old order lines out again from today's buy prices, for the Profit & Margins report.
// Lines sold before costs were recorded (the old site's orders, from db:legacy:import or the 20261105120000 migration)
// got a cost estimated from the buy price when they came across, and keep it: a sale's cost is never changed later. So
// buy prices corrected after the import leave those estimates wrong, and this puts them right.
//
// Only lines marked as estimated (OrderItem.costEstimated) are touched; lines sold since record the buy price at the
// sale and are left alone. Each line's cost follows the import's rule: its variant's buy price, else its listing's,
// else the catalogue product's (for products the store didn't list, which the import gave an archived listing). A buy
// price of 0 or none leaves the line without a cost ("Without a cost" in the report).
//
// Run with `pnpm --filter @workspace/db db:reestimate-costs [--store <slug>] [--dry-run]`. --dry-run reports what
// would change without writing; --store limits it to one store's lines. Safe to run again: it only writes lines whose
// estimate differs from today's buy prices.
import { prisma } from "../src/client"
import { Prisma } from "../generated/prisma/client"

const argv = process.argv.slice(2)
const dryRun = argv.includes("--dry-run")
const storeIndex = argv.indexOf("--store")
const storeSlug = storeIndex === -1 ? null : argv[storeIndex + 1]
if (storeIndex !== -1 && !storeSlug) throw new Error("Give the store's slug after --store.")

// How many changed lines to list in the report
const LISTED = 20

const positive = (value: Prisma.Decimal | null | undefined) => (value && value.gt(0) ? value : null)
const show = (value: Prisma.Decimal | null) => (value ? `$${value.toFixed(2)}` : "none")
const lines = (count: number) => (count === 1 ? "1 line" : `${count} lines`)

async function main() {
  const store = storeSlug ? await prisma.organization.findUnique({ where: { slug: storeSlug }, select: { id: true, name: true } }) : null
  if (storeSlug && !store) throw new Error(`No store has the slug ${storeSlug}.`)

  const estimated = await prisma.orderItem.findMany({
    where: { costEstimated: true, ...(store && { organizationId: store.id }) },
    select: {
      id: true,
      unitCostUsd: true,
      productName: true,
      variantDescription: true,
      order: { select: { reference: true } },
      storeListing: { select: { buyPrice: true, product: { select: { baseBuyPrice: true } } } },
      storeListingVariant: { select: { buyPrice: true } },
    },
  })

  // Today's estimate per line, and the lines whose estimate changes
  const changes = estimated.flatMap((line) => {
    const cost = positive(line.storeListingVariant?.buyPrice) ?? positive(line.storeListing.buyPrice) ?? positive(line.storeListing.product.baseBuyPrice)
    const same = cost && line.unitCostUsd ? cost.equals(line.unitCostUsd) : cost === line.unitCostUsd
    return same ? [] : [{ line, cost }]
  })

  const gained = changes.filter(({ line, cost }) => cost && !line.unitCostUsd).length
  const lost = changes.filter(({ line, cost }) => !cost && line.unitCostUsd).length
  console.log(
    `${lines(estimated.length)} with an estimated cost${store ? ` in ${store.name}` : ""}: ${changes.length} to change (${gained} gain a cost, ${lost} lose theirs), ${estimated.length - changes.length} already right.`
  )
  for (const { line, cost } of changes.slice(0, LISTED)) {
    const name = line.variantDescription ? `${line.productName} (${line.variantDescription})` : line.productName
    console.log(`  ${line.order.reference}  ${name}: ${show(line.unitCostUsd)} → ${show(cost)}`)
  }
  if (changes.length > LISTED) console.log(`  …and ${changes.length - LISTED} more`)

  if (dryRun) {
    console.log("Dry run: nothing was written.")
    return
  }
  if (changes.length === 0) return

  // One update per new cost rather than per line: the remote database takes a round trip each
  const byCost = new Map<string, { cost: Prisma.Decimal | null; ids: string[] }>()
  for (const { line, cost } of changes) {
    const key = cost?.toFixed(2) ?? "none"
    const group = byCost.get(key) ?? { cost, ids: [] }
    group.ids.push(line.id)
    byCost.set(key, group)
  }
  await prisma.$transaction(
    async (tx) => {
      for (const { cost, ids } of byCost.values()) await tx.orderItem.updateMany({ where: { id: { in: ids }, costEstimated: true }, data: { unitCostUsd: cost } })
    },
    { maxWait: 30_000, timeout: 600_000 }
  )
  console.log(`Updated ${lines(changes.length)}.`)
}

try {
  await main()
} catch (error) {
  console.error("Re-estimating failed:", error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
