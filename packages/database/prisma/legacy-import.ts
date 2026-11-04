// Imports the old bs42.net system's records (from legacy-export.ts) into one store, for going live: its orders and
// quotations as history, its suppliers, its inventory orders as purchase orders (with their files), and its stock
// counts as the store's opening stock.
//
// On launch day, once the old system has stopped taking orders, after db:seed and db:seed:listings for the store:
//   pnpm --filter @workspace/db db:legacy:export --out <folder>
//   AZURE_STORAGE_ACCOUNT_NAME=<account> pnpm --filter @workspace/db db:legacy:import --store <slug> --data <folder> --by <email> --dry-run
//   AZURE_STORAGE_ACCOUNT_NAME=<account> pnpm --filter @workspace/db db:legacy:import --store <slug> --data <folder> --by <email>
// --by names a console user recorded as the orders' creator (the old system's orders were all entered by staff), and
// as the quotes' and purchase orders' where their old author has no console account by the same email.
// --dry-run reports what it would do and checks every order's total, writing nothing. The import is written in one
// transaction, and what it wrote is logged in the data folder (legacy-import-log.json): --undo removes exactly that,
// for a rehearsal. It refuses to run twice into the same folder.
//
// What it does, and why:
// - Old products are traced to the catalogue through seed-products.json's `from` (old slugs; a merged product's are in
//   its variants' order). Order lines need a store listing, so a product the store doesn't list gets an archived one.
//   A product deleted on the old site is matched by its title to one still there (some were deleted and made again).
//   Lines with no product (labour, installation) and products gone for good go to an archived "Item from the old site".
// - Amounts: the old system priced in USD and kept each order's rate; cedi amounts are worked out as the old pages
//   showed them (USD × rate, each line rounded once). No tax. Its discount "equivalent" is already in cedis.
// - Stock: each listed product (or variant) the store hasn't counted yet gets the old count as initial stock. A product
//   the store doesn't list (a draft with no price, which db:seed:listings skips) gets a draft listing holding its
//   count, for staff to price and publish.
// - Costs: the old orders didn't record what each item cost, so each line's is estimated from the buy price now (the
//   store's listing's, else the catalogue's) and marked as estimated, for the profit report.
// - Orders are staff-made (--by), so the storefront's unpaid-order job leaves the open ones alone. Their lines took no
//   stock (tracksStock false): stock comes from the old counts instead. Walk-in sales carry the shop's own address,
//   which is dropped (it would hand them all to whoever verified it); the name and phone stay.
// - Nothing sends email or notifications: everything is written directly.
import { randomUUID } from "node:crypto"
import { readFile, rename, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { PLATFORM_ORGANIZATION_SLUG } from "@workspace/contracts"
import { removePrivateFiles, uploadPrivateFiles } from "@workspace/storage"
import { Prisma } from "../generated/prisma/client"
import { prisma } from "../src/client"
import { listingVariantPrices } from "./product-seeds"

const D = (value: number | string) => new Prisma.Decimal(value)
const money = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
const ZERO = D(0)

const SHOP_EMAIL_DOMAIN = "@bs42.net"
const QUOTE_VALIDITY_DAYS = 7
const LOW_STOCK_THRESHOLD = 5
const PLACEHOLDER_PRODUCT = "Item from the old site"
const PLACEHOLDER_CATEGORY = "Old site services"
const BATCH = 500
const LOG_FILE = "legacy-import-log.json"
// The old system's test records, left behind like its test product (which the catalogue seed dropped): a supplier, and
// any inventory order made up only of test products
const TEST_SUPPLIERS = ["acme ltd"]
const TEST_PRODUCT_SLUGS = ["test-product"]

// ---- The old system's records (only the fields used) ----

type OldStatus = { type: string; timestamp: string }
type OldLine = { productRef?: string | null; title: string; quantity: number; price?: number; buyPrice?: number }
type OldPerson = { firstName?: string; lastName?: string; email?: string; phone?: string }
type OldShipping = OldPerson & { address?: string; region?: string; town?: string; method?: string; cost?: number }
type OldDiscount = { type?: "percentage" | "amount"; value?: number; equivalent?: number; reason?: string }
type Ref = string | { _id: string } | null | undefined

interface OldOrder {
  _id: string
  orderNumber: string
  createdAt: string
  updatedAt: string
  contact?: OldPerson
  billing?: OldPerson
  shipping: OldShipping
  invoice?: { number?: string }
  status: OldStatus[]
  rate: number
  discount?: OldDiscount
  products: OldLine[]
  total?: number
  notes?: string
}
interface OldQuote extends Omit<OldOrder, "orderNumber" | "status" | "invoice"> {
  quotationNumber: string
  createdBy?: Ref
  order?: Ref
}
interface OldSupplier {
  _id: string
  name: string
  accountID?: string
  vatID?: string
  website?: { company?: string; alibaba?: string }
  contact?: { firstName?: string; lastName?: string; email?: string; primaryPhone?: string; secondaryPhone?: string; fax?: string }
  address?: { line1?: string; line2?: string; townCity?: string; stateCounty?: string; country?: string; postCode?: string }
  notes?: string
  isActive?: boolean
}
interface OldInventoryOrder {
  _id: string
  orderNumber: string
  createdAt: string
  user?: Ref
  supplier?: Ref
  products: OldLine[]
  files?: { name?: string; originalName?: string; url: string }[]
  shippingCost?: number
  status: OldStatus[]
}
interface OldStockLevel {
  product: Ref
  count?: number
  min?: number
}

const refId = (ref: Ref) => (ref && typeof ref === "object" ? ref._id : (ref ?? null))
const text = (value: string | null | undefined) => value?.replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim() || null
const fullName = (person?: OldPerson) => text([person?.firstName, person?.lastName].filter(Boolean).join(" "))
const day = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "")
const reference = (prefix: string, date: Date, n: number) => `${prefix}-${day(date)}-${String(n).padStart(5, "0")}`

// Phones are stored international ("+233244123456"); the old system kept them as typed
function phone(value: string | null | undefined) {
  const raw = text(value)
  if (!raw) return null
  const compact = raw.replace(/[^\d+]/g, "")
  if (compact.startsWith("+")) return compact
  if (compact.startsWith("00")) return `+${compact.slice(2)}`
  if (compact.startsWith("233")) return `+${compact}`
  if (compact.startsWith("0")) return `+233${compact.slice(1)}`
  return compact || null
}

// The shop's own address, used for walk-in sales, isn't a customer's
function customerEmail(value: string | null | undefined) {
  const email = text(value)?.toLowerCase()
  return email && !email.endsWith(SHOP_EMAIL_DOMAIN) ? email : null
}

// ---- Arguments ----

function arg(name: string, required = true) {
  const at = process.argv.indexOf(name)
  const value = at === -1 ? undefined : process.argv[at + 1]
  if (required && (!value || value.startsWith("--"))) throw new Error(`Missing ${name} <value>`)
  return value
}
const flag = (name: string) => process.argv.includes(name)

async function readJson<T>(folder: string, file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(folder, file), "utf8")) as T
}

// ---- What was written, for --undo ----

interface ImportLog {
  storeId: string
  createdAt: string
  orders: string[]
  quotes: string[]
  suppliers: string[]
  purchaseOrders: string[]
  fileBlobs: string[]
  listings: string[]
  listingVariants: string[]
  stockMovements: string[]
  // Rows whose stock was set from the old counts, to put back to 0
  stockRows: { listingId: string; listingVariantId: string | null; lowStockThreshold: number; trackInventory: boolean }[]
  placeholderProduct: string | null
  placeholderCategory: string | null
}

async function undo(folder: string) {
  const logPath = path.join(folder, LOG_FILE)
  const log = await readJson<ImportLog>(folder, LOG_FILE)
  await prisma.$transaction(
    async (tx) => {
      await tx.purchaseOrder.deleteMany({ where: { id: { in: log.purchaseOrders } } })
      await tx.supplier.deleteMany({ where: { id: { in: log.suppliers } } })
      await tx.quote.deleteMany({ where: { id: { in: log.quotes } } })
      await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: log.orders } } })
      await tx.orderItem.deleteMany({ where: { orderId: { in: log.orders } } })
      await tx.order.deleteMany({ where: { id: { in: log.orders } } })
      await tx.stockMovement.deleteMany({ where: { id: { in: log.stockMovements } } })
      for (const row of log.stockRows) {
        const data = { stock: 0, lowStockThreshold: row.lowStockThreshold, trackInventory: row.trackInventory }
        if (row.listingVariantId) await tx.storeListingVariant.update({ where: { id: row.listingVariantId }, data })
        else await tx.storeListing.update({ where: { id: row.listingId }, data })
      }
      await tx.storeListingVariant.deleteMany({ where: { id: { in: log.listingVariants } } })
      await tx.storeListing.deleteMany({ where: { id: { in: log.listings } } })
      if (log.placeholderProduct) await tx.product.delete({ where: { id: log.placeholderProduct } })
      if (log.placeholderCategory) await tx.category.delete({ where: { id: log.placeholderCategory } })
    },
    { maxWait: 30_000, timeout: 600_000 }
  )
  await removePrivateFiles(log.fileBlobs, "Legacy import undo")
  await rename(logPath, `${logPath}.undone-${Date.now()}`)
  console.log(`Removed ${log.orders.length} orders, ${log.quotes.length} quotes, ${log.suppliers.length} suppliers, ${log.purchaseOrders.length} purchase orders and the opening stock.`)
}

// ---- The import ----

async function main() {
  const folder = path.resolve(arg("--data")!)
  if (flag("--undo")) return undo(folder)

  const dryRun = flag("--dry-run")
  const slug = arg("--store")!
  if (slug === PLATFORM_ORGANIZATION_SLUG) throw new Error("That's the platform, not a store")
  const store = await prisma.organization.findUnique({ where: { slug }, select: { id: true, name: true } })
  if (!store) throw new Error(`No store has the slug "${slug}"`)
  const byEmail = arg("--by")!.toLowerCase()
  const by = await prisma.user.findUnique({ where: { email: byEmail }, select: { id: true, members: { where: { organizationId: store.id }, select: { id: true } } } })
  if (!by || !by.members.length) throw new Error(`${byEmail} isn't a member of ${store.name}`)
  if (!dryRun && (await stat(path.join(folder, LOG_FILE)).catch(() => null))) throw new Error(`${LOG_FILE} exists: this folder has been imported already (--undo removes it)`)

  const [orders, quotes, suppliers, inventoryOrders, stockLevels, oldUsers, oldProducts] = await Promise.all([
    readJson<OldOrder[]>(folder, "orders.json"),
    readJson<OldQuote[]>(folder, "quotations.json"),
    readJson<OldSupplier[]>(folder, "suppliers.json"),
    readJson<OldInventoryOrder[]>(folder, "inventory-orders.json"),
    readJson<OldStockLevel[]>(folder, "stockLevels.json"),
    readJson<{ _id: string; email: string }[]>(folder, "users.json"),
    readJson<{ _id: string; slug: string; title: string }[]>(folder, "products.json"),
  ])
  const seed = JSON.parse(await readFile(path.join(import.meta.dirname, "seed-products.json"), "utf8")) as { name: string; from: string[]; variants?: unknown[] }[]

  const report: Record<string, unknown> = {}
  const warnings: string[] = []
  const skipped = { testRecords: [] as string[] }

  // Old staff → console users with the same email
  const consoleUsers = await prisma.user.findMany({ where: { email: { in: oldUsers.map((user) => user.email.trim().toLowerCase()) } }, select: { id: true, email: true } })
  const userByOldId = new Map(oldUsers.flatMap((user) => consoleUsers.filter((match) => match.email === user.email.trim().toLowerCase()).map((match) => [user._id, match.id] as const)))
  const staff = (ref: Ref) => userByOldId.get(refId(ref) ?? "") ?? by.id

  // ---- Old product → catalogue product (and variant) ----

  const slugByOldId = new Map(oldProducts.map((product) => [product._id, product.slug]))
  // For products deleted on the old site: one still there with the same title (only titles used once)
  const titleKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const titleCounts = new Map<string, number>()
  for (const product of oldProducts) titleCounts.set(titleKey(product.title), (titleCounts.get(titleKey(product.title)) ?? 0) + 1)
  const slugByTitle = new Map(oldProducts.filter((product) => titleCounts.get(titleKey(product.title)) === 1).map((product) => [titleKey(product.title), product.slug]))
  const seedBySlug = new Map(seed.flatMap((product) => product.from.map((from, index) => [from, { name: product.name, variantIndex: product.variants ? index : null }] as const)))
  const catalogue = await prisma.product.findMany({
    where: { name: { in: seed.map((product) => product.name) } },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      images: true,
      baseSellPrice: true,
      baseBuyPrice: true,
      variants: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, sku: true, images: true, variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } } },
      },
    },
  })
  const productByName = new Map(catalogue.map((product) => [product.name, product]))
  type CatalogueProduct = (typeof catalogue)[number]
  type Target = { product: CatalogueProduct; variant: CatalogueProduct["variants"][number] | null }

  const unmatched = new Map<string, number>()
  function target(oldId: string | null | undefined, title: string): Target | null {
    const slug = (oldId && slugByOldId.get(oldId)) || slugByTitle.get(titleKey(title))
    const found = slug ? seedBySlug.get(slug) : undefined
    const product = found && productByName.get(found.name)
    if (!found || !product) {
      unmatched.set(title, (unmatched.get(title) ?? 0) + 1)
      return null
    }
    const variant = found.variantIndex === null ? null : (product.variants[found.variantIndex] ?? null)
    if (found.variantIndex !== null && !variant) warnings.push(`${product.name} has no variant ${found.variantIndex + 1}`)
    return { product, variant }
  }
  const describe = (variant: Target["variant"]) =>
    variant?.variantValues.length
      ? [...variant.variantValues]
          .sort((a, b) => a.optionValue.option.position - b.optionValue.option.position)
          .map(({ optionValue }) => `${optionValue.option.name}: ${optionValue.value}`)
          .join(" / ")
      : null

  // ---- The store's listings, and those history needs ----

  const existing = await prisma.storeListing.findMany({
    where: { organizationId: store.id },
    select: {
      id: true,
      productId: true,
      buyPrice: true,
      stock: true,
      trackInventory: true,
      lowStockThreshold: true,
      _count: { select: { stockMovements: true } },
      storeListingVariants: { select: { id: true, variantId: true, buyPrice: true, stock: true, trackInventory: true, lowStockThreshold: true, _count: { select: { stockMovements: true } } } },
    },
  })
  const listingByProduct = new Map(existing.map((listing) => [listing.productId, listing]))
  const newListings: Prisma.StoreListingCreateManyInput[] = []
  const newListingVariants: Prisma.StoreListingVariantCreateManyInput[] = []
  const listingIds = new Map<string, string>()
  const listingVariantIds = new Map<string, string>()

  // A listing (and listing variant) for a line: the store's own, or an archived one only history uses
  function listingFor(t: Target): { listingId: string; listingVariantId: string | null } {
    const own = listingByProduct.get(t.product.id)
    let listingId = own?.id ?? listingIds.get(t.product.id)
    if (!listingId) {
      listingId = randomUUID()
      listingIds.set(t.product.id, listingId)
      newListings.push({ id: listingId, organizationId: store!.id, productId: t.product.id, sellPrice: t.product.baseSellPrice, trackInventory: false, lowStockThreshold: LOW_STOCK_THRESHOLD, stock: 0, status: "ARCHIVED" })
    }
    if (!t.variant) return { listingId, listingVariantId: null }
    let listingVariantId = own?.storeListingVariants.find((row) => row.variantId === t.variant!.id)?.id ?? listingVariantIds.get(t.variant.id)
    if (!listingVariantId) {
      listingVariantId = randomUUID()
      listingVariantIds.set(t.variant.id, listingVariantId)
      newListingVariants.push({ id: listingVariantId, storeListingId: listingId, variantId: t.variant.id, trackInventory: false, lowStockThreshold: LOW_STOCK_THRESHOLD, stock: 0, status: "ARCHIVED" })
    }
    return { listingId, listingVariantId }
  }

  // What a sold unit cost, estimated from the buy price now (the old orders didn't record it): the store's variant's,
  // else its listing's, as a sale does; for a product the store doesn't list, the catalogue's (the old site's). The
  // placeholder and a buy price of 0 have none.
  function estimatedCost(t: Target | null) {
    if (!t) return null
    const own = listingByProduct.get(t.product.id)
    const cost = own
      ? ((t.variant && own.storeListingVariants.find((row) => row.variantId === t.variant!.id)?.buyPrice) ?? own.buyPrice)
      : ((t.variant && listingVariantPrices(t.product, t.variant.position).buyPrice) ?? t.product.baseBuyPrice)
    return cost?.gt(0) ? cost : null
  }

  // The placeholder for lines with no product, made inside the transaction (its slug and SKU come from query hooks)
  const placeholder = { productId: randomUUID(), categoryId: null as string | null, listingId: randomUUID(), used: false }
  const placeholderLine = () => {
    placeholder.used = true
    return { listingId: placeholder.listingId, listingVariantId: null }
  }

  // ---- Lines and amounts, shared by orders and quotes ----

  function priceLines(lines: OldLine[], rate: Prisma.Decimal, discountGhs: Prisma.Decimal) {
    const priced = lines.map((line) => {
      const t = target(line.productRef, line.title)
      const unitUsd = D(line.price ?? 0)
      const totalUsd = unitUsd.times(line.quantity)
      return { line, t, ...(t ? listingFor(t) : placeholderLine()), unitUsd, totalUsd, unitGhs: money(unitUsd.times(rate)), totalGhs: money(totalUsd.times(rate)), discountGhs: ZERO }
    })
    // The discount split by line totals, rounded down, with the remainder on the last line (as pricing does)
    const subtotalGhs = priced.reduce((sum, line) => sum.plus(line.totalGhs), ZERO)
    if (discountGhs.gt(0) && subtotalGhs.gt(0)) {
      let given = ZERO
      priced.forEach((line, index) => {
        line.discountGhs = index === priced.length - 1 ? discountGhs.minus(given) : discountGhs.times(line.totalGhs).dividedBy(subtotalGhs).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN)
        given = given.plus(line.discountGhs)
      })
    }
    return { priced, subtotalGhs, subtotalUsd: priced.reduce((sum, line) => sum.plus(line.totalUsd), ZERO) }
  }

  const lineSnapshot = (line: ReturnType<typeof priceLines>["priced"][number]) => ({
    organizationId: store.id,
    storeListingId: line.listingId,
    storeListingVariantId: line.listingVariantId,
    quantity: line.line.quantity,
    unitPriceUsd: line.unitUsd,
    totalPriceUsd: line.totalUsd,
    unitPriceGhs: line.unitGhs,
    totalPriceGhs: line.totalGhs,
    discountGhs: line.discountGhs,
    taxGhs: ZERO,
    installationUnitGhs: null,
    installationTotalGhs: ZERO,
    installationTaxGhs: ZERO,
    // What was sold, as the old system named it
    productName: text(line.line.title) ?? "Item",
    productSlug: line.t?.product.slug ?? "",
    productImage: line.t?.variant?.images[0] ?? line.t?.product.images[0] ?? null,
    variantDescription: describe(line.t?.variant ?? null),
    sku: line.t?.variant?.sku ?? line.t?.product.sku ?? null,
    storeName: store.name,
    productId: line.t?.product.id ?? placeholder.productId,
    productVariantId: line.t?.variant?.id ?? null,
  })

  // The old discount in cedis: its "equivalent", unless the old total says otherwise (one order did)
  function discountOf(old: OldOrder | OldQuote, rate: Prisma.Decimal) {
    const lines = old.products.reduce((sum, line) => sum.plus(D(line.price ?? 0).times(line.quantity)), ZERO)
    const shipping = D(old.shipping?.cost ?? 0)
    const equivalent = money(D(old.discount?.equivalent ?? 0))
    const fromTotal = old.total === undefined ? null : money(lines.plus(shipping).minus(D(old.total)).times(rate))
    const amount = fromTotal && fromTotal.minus(equivalent).abs().gt(1) ? fromTotal : equivalent
    if (!amount.gt(0)) return { amount: ZERO, type: null, value: null, reason: null }
    const percentage = old.discount?.type === "percentage"
    return { amount, type: percentage ? ("PERCENTAGE" as const) : ("FIXED" as const), value: percentage ? D(old.discount?.value ?? 0) : amount, reason: text(old.discount?.reason) }
  }

  // ---- Orders ----

  const STATUS: Record<string, "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED"> = {
    created: "PENDING",
    processing: "PROCESSING",
    readyForPickup: "PROCESSING",
    delivering: "SHIPPED",
    delivered: "DELIVERED",
    pickedUp: "DELIVERED",
    cancelled: "CANCELLED",
  }

  const orderRows: Prisma.OrderCreateManyInput[] = []
  const orderItems: Prisma.OrderItemCreateManyInput[] = []
  const orderHistory: Prisma.OrderStatusHistoryCreateManyInput[] = []
  const orderIdByOld = new Map<string, string>()
  const totalMismatches: string[] = []
  // The old steps' times are the sale's: staff often entered a counter sale later (the record's createdAt), and saved
  // all its steps in the same second. So the order is dated by its first step, and its steps are spread a second apart
  // in their order, so its timeline (payment included) reads in sequence.
  const timed = (old: OldOrder) => {
    let previous = 0
    return old.status.map((step) => {
      const at = Math.max(new Date(step.timestamp).getTime(), previous + 1000)
      previous = at
      return { type: step.type, at: new Date(at) }
    })
  }
  const saleDate = (old: OldOrder) => (old.status[0] ? new Date(old.status[0].timestamp) : new Date(old.createdAt))
  const sortedOrders = [...orders].sort((a, b) => saleDate(a).getTime() - saleDate(b).getTime())

  for (const old of sortedOrders) {
    const id = randomUUID()
    orderIdByOld.set(old._id, id)
    const rate = D(old.rate)
    const discount = discountOf(old, rate)
    const { priced, subtotalGhs, subtotalUsd } = priceLines(old.products, rate, discount.amount)
    const shippingGhs = money(D(old.shipping?.cost ?? 0).times(rate))
    const totalGhs = subtotalGhs.minus(discount.amount).plus(shippingGhs)
    const charged = old.total === undefined ? null : money(D(old.total).times(rate))
    if (charged && totalGhs.minus(charged).abs().gt(0.05)) totalMismatches.push(`${old.orderNumber}: ${totalGhs} here, ${charged} there`)

    // Its history: the old steps, without payment (that's paidAt) or repeats; a paid order that reached the customer
    // ends completed, as it would here
    const steps = timed(old)
    const history: { status: Prisma.OrderStatusHistoryCreateManyInput["status"]; at: Date; note: string | null }[] = []
    for (const step of steps) {
      const status = STATUS[step.type]
      if (!status || history.at(-1)?.status === status) continue
      history.push({ status, at: step.at, note: step.type === "pickedUp" ? "Picked up" : step.type === "cancelled" ? "Cancelled on the old site" : null })
    }
    const paid = steps.find((step) => step.type === "paymentReceived")
    if (paid && history.at(-1)?.status === "DELIVERED") history.push({ status: "COMPLETED", at: new Date(history.at(-1)!.at.getTime() + 1000), note: null })
    const placedAt = steps[0]?.at ?? new Date(old.createdAt)
    if (!history.length) history.push({ status: "PENDING", at: placedAt, note: null })
    history[0]!.note = `Imported from the old site (order ${old.orderNumber})`

    const delivery = old.shipping?.method === "delivery"
    const person = old.contact ?? old.billing
    orderRows.push({
      id,
      reference: "",
      customerName: fullName(person) ?? fullName(old.billing) ?? "Walk-in customer",
      customerEmail: customerEmail(person?.email),
      customerPhone: phone(person?.phone),
      shippingMethod: delivery ? "DELIVERY" : "PICKUP",
      shippingName: delivery ? fullName(old.shipping) : null,
      shippingPhone: delivery ? phone(old.shipping.phone) : null,
      shippingRegion: delivery ? text(old.shipping.region) : null,
      shippingTown: delivery ? text(old.shipping.town) : null,
      shippingLine1: delivery ? text(old.shipping.address) : null,
      // The old system never recorded how a sale was paid
      paymentMethod: "CASH",
      paymentStatus: paid ? "PAID" : "PENDING",
      paidAt: paid?.at ?? null,
      status: history.at(-1)!.status,
      subtotalUsd,
      subtotalGhs,
      shippingGhs,
      installationGhs: ZERO,
      taxGhs: ZERO,
      taxRate: ZERO,
      totalGhs,
      discountType: discount.type,
      discountValue: discount.value,
      discountAmountGhs: discount.type ? discount.amount : null,
      discountReason: discount.reason,
      exchangeRate: rate.toDecimalPlaces(6),
      createdById: by.id,
      notes: [`Old site order ${old.orderNumber}${old.invoice?.number ? `, invoice ${old.invoice.number}` : ""}. The old site didn't record how it was paid.`, text(old.notes)].filter(Boolean).join("\n"),
      createdAt: placedAt,
      updatedAt: history.at(-1)!.at,
    })
    for (const line of priced) orderItems.push({ id: randomUUID(), orderId: id, tracksStock: false, ...lineSnapshot(line), unitCostUsd: estimatedCost(line.t), costEstimated: true })
    for (const step of history) orderHistory.push({ id: randomUUID(), orderId: id, status: step.status, note: step.note, changedById: by.id, createdAt: step.at })
  }
  report.orders = { count: orderRows.length, lines: orderItems.length, paid: orderRows.filter((row) => row.paymentStatus === "PAID").length, open: orderRows.filter((row) => row.status !== "COMPLETED" && row.status !== "CANCELLED").length, withEmail: orderRows.filter((row) => row.customerEmail).length, linesWithCost: orderItems.filter((item) => item.unitCostUsd).length, totalMismatches: totalMismatches.length }

  // ---- Quotations ----

  const quoteRows: Prisma.QuoteCreateManyInput[] = []
  const quoteItems: Prisma.QuoteItemCreateManyInput[] = []
  const sortedQuotes = [...quotes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const old of sortedQuotes) {
    const id = randomUUID()
    const rate = D(old.rate)
    const discount = discountOf(old, rate)
    const { priced, subtotalGhs, subtotalUsd } = priceLines(old.products, rate, discount.amount)
    const shippingGhs = money(D(old.shipping?.cost ?? 0).times(rate))
    const createdAt = new Date(old.createdAt)
    // Valid for the old system's 7 days: the start of the day after the last
    const validUntil = new Date(Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate() + QUOTE_VALIDITY_DAYS + 1))
    const orderId = orderIdByOld.get(refId(old.order) ?? "") ?? null
    const person = old.contact ?? old.billing
    quoteRows.push({
      id,
      reference: "",
      createdById: staff(old.createdBy),
      notes: text(old.notes),
      customerName: fullName(person) ?? "Walk-in customer",
      customerEmail: customerEmail(person?.email) ?? "",
      customerPhone: phone(person?.phone) ?? "",
      shippingLine1: text(old.shipping?.address) ?? "",
      shippingRegion: text(old.shipping?.region) ?? "",
      shippingTown: text(old.shipping?.town) ?? "",
      // An accepted one links its order; the rest are open and long expired, so nobody can accept them
      status: orderId ? "ACCEPTED" : "OPEN",
      validUntil,
      subtotalUsd,
      subtotalGhs,
      discountType: discount.type,
      discountValue: discount.value,
      discountAmountGhs: discount.type ? discount.amount : null,
      discountReason: discount.reason,
      shippingGhs,
      installationGhs: ZERO,
      taxRate: ZERO,
      taxGhs: ZERO,
      totalGhs: subtotalGhs.minus(discount.amount).plus(shippingGhs),
      exchangeRate: rate.toDecimalPlaces(6),
      orderId,
      createdAt,
      updatedAt: new Date(old.updatedAt),
    })
    for (const line of priced) quoteItems.push({ id: randomUUID(), quoteId: id, hasVariant: !!line.t?.variant, ...lineSnapshot(line) })
  }
  report.quotes = { count: quoteRows.length, accepted: quoteRows.filter((row) => row.status === "ACCEPTED").length }

  // ---- Suppliers ----

  const existingSuppliers = new Map((await prisma.supplier.findMany({ where: { organizationId: store.id }, select: { id: true, name: true } })).map((supplier) => [supplier.name.toLowerCase(), supplier.id]))
  const supplierRows: Prisma.SupplierCreateManyInput[] = []
  const supplierIdByOld = new Map<string, string>()
  for (const old of suppliers) {
    const name = text(old.name) ?? "Supplier"
    if (TEST_SUPPLIERS.includes(name.toLowerCase())) {
      skipped.testRecords.push(`supplier ${name}`)
      continue
    }
    const reuse = existingSuppliers.get(name.toLowerCase())
    if (reuse) {
      supplierIdByOld.set(old._id, reuse)
      warnings.push(`Supplier "${name}" already exists: its purchase orders use it`)
      continue
    }
    const id = randomUUID()
    supplierIdByOld.set(old._id, id)
    existingSuppliers.set(name.toLowerCase(), id)
    const contact = old.contact ?? {}
    const address = old.address ?? {}
    supplierRows.push({
      id,
      organizationId: store.id,
      name,
      contactName: fullName(contact),
      email: text(contact.email)?.toLowerCase() ?? null,
      phone: phone(contact.primaryPhone),
      address: [address.line1, address.line2, address.townCity, address.stateCounty, address.postCode, address.country].map(text).filter(Boolean).join(", ") || null,
      notes:
        [
          old.accountID && `Account ID: ${old.accountID}`,
          old.vatID && `VAT ID: ${old.vatID}`,
          old.website?.company && `Website: ${old.website.company}`,
          old.website?.alibaba && `Alibaba: ${old.website.alibaba}`,
          contact.secondaryPhone && `Other phone: ${contact.secondaryPhone}`,
          contact.fax && `Fax: ${contact.fax}`,
          text(old.notes),
        ]
          .map((note) => text(note || null))
          .filter(Boolean)
          .join("\n") || null,
      isArchived: old.isActive === false,
    })
  }
  report.suppliers = { new: supplierRows.length, reused: suppliers.length - supplierRows.length }

  // ---- Inventory orders → purchase orders ----

  const poRows: Prisma.PurchaseOrderCreateManyInput[] = []
  const poItems: Prisma.PurchaseOrderItemCreateManyInput[] = []
  const receipts: Prisma.PurchaseOrderReceiptCreateManyInput[] = []
  const receiptItems: Prisma.PurchaseOrderReceiptItemCreateManyInput[] = []
  const poFiles: { purchaseOrderId: string; url: string; name: string }[] = []
  const isTestProduct = (line: OldLine) => TEST_PRODUCT_SLUGS.includes(slugByOldId.get(line.productRef ?? "") ?? "") || line.title.trim().toLowerCase() === "test product"
  for (const old of [...inventoryOrders].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (old.products.length && old.products.every(isTestProduct)) {
      skipped.testRecords.push(`inventory order ${old.orderNumber}`)
      continue
    }
    const supplierId = supplierIdByOld.get(refId(old.supplier) ?? "")
    if (!supplierId) {
      warnings.push(`Inventory order ${old.orderNumber} has no supplier: skipped`)
      continue
    }
    const id = randomUUID()
    const steps = old.status
    const last = steps.at(-1)?.type
    const status = last === "delivered" ? "RECEIVED" : last === "cancelled" ? "CANCELLED" : "ORDERED"
    const at = (type: string) => {
      const step = steps.find((entry) => entry.type === type)
      return step ? new Date(step.timestamp) : null
    }
    const createdAt = new Date(old.createdAt)
    const author = staff(old.user)
    poRows.push({
      id,
      organizationId: store.id,
      supplierId,
      reference: "",
      status,
      currency: "USD",
      shippingCost: money(D(old.shippingCost ?? 0)),
      notes: `Old site inventory order ${old.orderNumber}`,
      createdById: author,
      // A second after it was made, so the timeline shows them in order
      orderedAt: new Date(createdAt.getTime() + 1000),
      orderedById: author,
      closedAt: status === "CANCELLED" ? (at("cancelled") ?? createdAt) : null,
      closedById: status === "CANCELLED" ? author : null,
      closeReason: status === "CANCELLED" ? "Cancelled on the old site" : null,
      createdAt,
      updatedAt: at(last ?? "") ?? createdAt,
    })
    const receiptId = status === "RECEIVED" ? randomUUID() : null
    if (receiptId) receipts.push({ id: receiptId, purchaseOrderId: id, receivedById: author, note: "Received on the old site", updatedBuyPrices: false, createdAt: at("delivered") ?? createdAt })
    old.products.forEach((line, position) => {
      const t = target(line.productRef, line.title)
      const { listingId, listingVariantId } = t ? listingFor(t) : placeholderLine()
      const itemId = randomUUID()
      const cost = money(D(line.buyPrice ?? 0))
      poItems.push({
        id: itemId,
        purchaseOrderId: id,
        storeListingId: listingId,
        storeListingVariantId: listingVariantId,
        productName: text(line.title) ?? "Item",
        variantDescription: describe(t?.variant ?? null),
        sku: t?.variant?.sku ?? t?.product.sku ?? null,
        quantityOrdered: line.quantity,
        quantityReceived: receiptId ? line.quantity : 0,
        unitCost: cost,
        unitCostUsd: cost,
        position,
      })
      if (receiptId) receiptItems.push({ id: randomUUID(), receiptId, purchaseOrderItemId: itemId, quantity: line.quantity })
    })
    for (const file of old.files ?? []) poFiles.push({ purchaseOrderId: id, url: file.url, name: text(file.originalName) ?? text(file.name) ?? "File" })
  }
  report.purchaseOrders = { count: poRows.length, received: receipts.length, files: poFiles.length }

  // ---- Opening stock ----

  // Duplicates merged into one product add up
  const counts = new Map<string, { t: Target; count: number; min: number }>()
  for (const level of stockLevels) {
    const oldId = refId(level.product)
    const title = typeof level.product === "object" && level.product && "title" in level.product ? String((level.product as { title: string }).title) : String(oldId)
    const t = target(oldId, title)
    if (!t) continue
    const key = t.variant?.id ?? t.product.id
    const entry = counts.get(key) ?? { t, count: 0, min: 0 }
    entry.count += Math.max(0, Math.trunc(level.count ?? 0))
    entry.min = Math.max(entry.min, Math.trunc(level.min ?? 0))
    counts.set(key, entry)
  }
  const stockUpdates: { listingId: string; listingVariantId: string | null; count: number; min: number; was: { lowStockThreshold: number; trackInventory: boolean } }[] = []
  const draftStock: { listingId: string; listingVariantId: string | null; count: number }[] = []
  const stockSkipped = { notListedNoStock: 0, alreadyCounted: 0 }
  for (const { t, count, min } of counts.values()) {
    // Only the store's own listings, untouched since db:seed:listings: never one someone has counted already
    const listing = listingByProduct.get(t.product.id)
    const row = t.variant ? listing?.storeListingVariants.find((entry) => entry.variantId === t.variant!.id) : listing
    if (!listing || !row) {
      if (count === 0) {
        stockSkipped.notListedNoStock++
        continue
      }
      // A draft listing holding the stock (made here, or the archived one history made, turned into a draft)
      const { listingId, listingVariantId } = listingFor(t)
      const created = { status: "DRAFT" as const, trackInventory: true, stock: count, lowStockThreshold: min > 0 ? min : LOW_STOCK_THRESHOLD }
      const newListing = newListings.find((entry) => entry.id === listingId)
      if (newListing) Object.assign(newListing, listingVariantId ? { status: "DRAFT" } : created)
      if (listingVariantId) {
        const newVariant = newListingVariants.find((entry) => entry.id === listingVariantId)
        if (newVariant) Object.assign(newVariant, created)
      }
      draftStock.push({ listingId, listingVariantId, count })
      continue
    }
    if (row.stock !== 0 || row._count.stockMovements > 0) {
      stockSkipped.alreadyCounted++
      continue
    }
    stockUpdates.push({ listingId: listing.id, listingVariantId: t.variant ? row.id : null, count, min, was: { lowStockThreshold: row.lowStockThreshold, trackInventory: row.trackInventory } })
  }
  report.stock = {
    set: stockUpdates.length,
    units: stockUpdates.reduce((sum, row) => sum + row.count, 0),
    draftListingsWithStock: draftStock.length,
    draftUnits: draftStock.reduce((sum, row) => sum + row.count, 0),
    ...stockSkipped,
  }
  report.history = {
    archivedListings: newListings.filter((row) => row.status === "ARCHIVED").length,
    archivedListingVariants: newListingVariants.filter((row) => row.status === "ARCHIVED").length,
    placeholderLines: placeholder.used,
  }
  report.notInCatalogue = Object.fromEntries(unmatched)
  report.skipped = skipped.testRecords

  console.log(JSON.stringify(report, null, 1))
  if (totalMismatches.length) console.log("Totals that don't match the old system's:\n  " + totalMismatches.join("\n  "))
  if (warnings.length) console.log("Warnings:\n  " + [...new Set(warnings)].join("\n  "))
  if (dryRun) return console.log("Dry run: nothing was written.")

  // ---- Write it ----

  // The old files first: their blobs must exist before the rows that name them
  const fileRows: Prisma.PurchaseOrderFileCreateManyInput[] = []
  const blobs: string[] = []
  try {
    for (const file of poFiles) {
      const response = await fetch(file.url)
      if (!response.ok) {
        warnings.push(`Couldn't download ${file.url} (${response.status})`)
        continue
      }
      const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase()
      const contentType = ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(type) ? type : file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : type
      const body = new File([await response.arrayBuffer()], file.name, { type: contentType })
      const [blobName] = await uploadPrivateFiles([body])
      blobs.push(blobName!)
      fileRows.push({ purchaseOrderId: file.purchaseOrderId, blobName: blobName!, name: file.name.slice(0, 200), contentType, size: body.size, uploadedById: by.id })
    }
  } catch (error) {
    await removePrivateFiles(blobs, "Legacy import cleanup")
    throw error
  }

  const log: ImportLog = {
    storeId: store.id,
    createdAt: new Date().toISOString(),
    orders: orderRows.map((row) => row.id!),
    quotes: quoteRows.map((row) => row.id!),
    suppliers: supplierRows.map((row) => row.id!),
    purchaseOrders: poRows.map((row) => row.id!),
    fileBlobs: blobs,
    listings: [...newListings.map((row) => row.id!), ...(placeholder.used ? [placeholder.listingId] : [])],
    listingVariants: newListingVariants.map((row) => row.id!),
    stockMovements: [],
    stockRows: stockUpdates.map((row) => ({ listingId: row.listingId, listingVariantId: row.listingVariantId, ...row.was })),
    placeholderProduct: placeholder.used ? placeholder.productId : null,
    placeholderCategory: null,
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const createMany = async <T>(rows: T[], write: (batch: T[]) => Promise<unknown>) => {
          for (let i = 0; i < rows.length; i += BATCH) await write(rows.slice(i, i + BATCH))
        }
        // References from the sequences, in date order like the rows
        const next = async (sequence: string, count: number) =>
          count ? (await tx.$queryRaw<{ n: number }[]>`SELECT nextval(${sequence}::regclass)::int AS n FROM generate_series(1, ${count})`).map((row) => row.n).sort((a, b) => a - b) : []
        const orderNumbers = await next("order_reference_seq", orderRows.length)
        const quoteNumbers = await next("quote_reference_seq", quoteRows.length)
        const poNumbers = await next("purchase_order_reference_seq", poRows.length)
        orderRows.forEach((row, index) => (row.reference = reference("BS42", row.createdAt as Date, orderNumbers[index]!)))
        quoteRows.forEach((row, index) => (row.reference = reference("QT", row.createdAt as Date, quoteNumbers[index]!)))
        poRows.forEach((row, index) => (row.reference = reference("PO", row.createdAt as Date, poNumbers[index]!)))

        if (placeholder.used) {
          const brand = (await tx.brand.findFirst({ where: { name: { equals: store.name, mode: "insensitive" } }, select: { id: true } })) ?? (await tx.brand.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } }))
          let category = await tx.category.findFirst({ where: { name: PLACEHOLDER_CATEGORY, parentId: null }, select: { id: true } })
          if (!category) {
            category = await tx.category.create({ data: { name: PLACEHOLDER_CATEGORY, slug: "placeholder", status: "ARCHIVED" }, select: { id: true } })
            log.placeholderCategory = category.id
          }
          await tx.product.create({ data: { id: placeholder.productId, name: PLACEHOLDER_PRODUCT, slug: "placeholder", brandId: brand.id, categoryId: category.id, baseSellPrice: 0, baseBuyPrice: 0, status: "ARCHIVED", installation: "NONE" } })
          newListings.push({ id: placeholder.listingId, organizationId: store.id, productId: placeholder.productId, sellPrice: 0, trackInventory: false, lowStockThreshold: LOW_STOCK_THRESHOLD, stock: 0, status: "ARCHIVED" })
          // The lines named it before it had its slug
          const { slug } = await tx.product.findUniqueOrThrow({ where: { id: placeholder.productId }, select: { slug: true } })
          for (const item of [...orderItems, ...quoteItems]) if (item.productId === placeholder.productId) item.productSlug = slug
        }

        await createMany(newListings, (batch) => tx.storeListing.createMany({ data: batch }))
        await createMany(newListingVariants, (batch) => tx.storeListingVariant.createMany({ data: batch }))
        await createMany(orderRows, (batch) => tx.order.createMany({ data: batch }))
        await createMany(orderItems, (batch) => tx.orderItem.createMany({ data: batch }))
        await createMany(orderHistory, (batch) => tx.orderStatusHistory.createMany({ data: batch }))
        await createMany(quoteRows, (batch) => tx.quote.createMany({ data: batch }))
        await createMany(quoteItems, (batch) => tx.quoteItem.createMany({ data: batch }))
        await createMany(supplierRows, (batch) => tx.supplier.createMany({ data: batch }))
        await createMany(poRows, (batch) => tx.purchaseOrder.createMany({ data: batch }))
        await createMany(poItems, (batch) => tx.purchaseOrderItem.createMany({ data: batch }))
        await createMany(receipts, (batch) => tx.purchaseOrderReceipt.createMany({ data: batch }))
        await createMany(receiptItems, (batch) => tx.purchaseOrderReceiptItem.createMany({ data: batch }))
        await createMany(fileRows, (batch) => tx.purchaseOrderFile.createMany({ data: batch }))

        // Opening stock, recorded as initial stock so the history adds up
        const movements: Prisma.StockMovementCreateManyInput[] = []
        for (const row of stockUpdates) {
          const data = { stock: row.count, trackInventory: true, ...(row.min > 0 && { lowStockThreshold: row.min }) }
          if (row.listingVariantId) await tx.storeListingVariant.update({ where: { id: row.listingVariantId }, data })
          else await tx.storeListing.update({ where: { id: row.listingId }, data })
          if (row.count > 0) {
            const id = randomUUID()
            log.stockMovements.push(id)
            movements.push({ id, storeListingId: row.listingId, storeListingVariantId: row.listingVariantId, change: row.count, stockAfter: row.count, reason: "INITIAL", note: "Opening stock from the old site", createdById: by.id })
          }
        }
        // The draft listings were made holding their stock
        for (const row of draftStock) {
          const id = randomUUID()
          log.stockMovements.push(id)
          movements.push({ id, storeListingId: row.listingId, storeListingVariantId: row.listingVariantId, change: row.count, stockAfter: row.count, reason: "INITIAL", note: "Opening stock from the old site", createdById: by.id })
        }
        await createMany(movements, (batch) => tx.stockMovement.createMany({ data: batch }))
      },
      { maxWait: 30_000, timeout: 600_000 }
    )
  } catch (error) {
    await removePrivateFiles(blobs, "Legacy import cleanup")
    throw error
  }

  await writeFile(path.join(folder, LOG_FILE), JSON.stringify(log, null, 1))
  if (warnings.length) console.log("Warnings while writing:\n  " + warnings.join("\n  "))
  console.log(`Imported into ${store.name}. What was written is in ${path.join(folder, LOG_FILE)} (--undo removes it).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
