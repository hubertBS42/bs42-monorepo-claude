import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus, PaymentStatus, ShippingMethod, Status } from "@workspace/db/enums"
import { formatDate } from "@workspace/utils/date"
import type { z } from "zod"
import type { PricedOrder } from "./order-pricing"
import type { orderItemInputSchema } from "./schemas/order.schemas"

// A store's order writes: creating one (lines priced from the store's listings, stock reserved) and moving its
// status on. In their own module (like listing-sync.ts) so they can be tested against the database without a session.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx
type OrderItemInput = z.output<typeof orderItemInputSchema>

// A line that can't be sold as asked: unavailable, or not enough stock. `item` names it for the message.
export class OrderItemError extends Error {
  readonly code: "ITEM_UNAVAILABLE" | "INSUFFICIENT_STOCK"
  readonly item: string

  constructor(code: "ITEM_UNAVAILABLE" | "INSUFFICIENT_STOCK", item: string) {
    super(code === "ITEM_UNAVAILABLE" ? `${item} is no longer on sale in this store.` : `There isn't enough stock of ${item}.`)
    this.code = code
    this.item = item
  }
}

export interface ResolvedLine {
  listingId: string
  listingVariantId: string | null
  quantity: number
  unitPriceUsd: Prisma.Decimal
  // What the stock check and reservation need
  stock: number
  trackInventory: boolean
  // The snapshot kept on the order line
  productId: string
  productVariantId: string | null
  productName: string
  productSlug: string
  productImage: string | null
  variantDescription: string | null
  sku: string | null
  storeName: string
  // "Tee (Size: M)", for messages
  label: string
}

// Looks up each line in the store's published listings, at the store's prices. Throws OrderItemError for a line
// that isn't on sale; stock is only checked when it's reserved.
export async function resolveOrderLines(client: Client, storeId: string, items: OrderItemInput[]): Promise<ResolvedLine[]> {
  const listings = await client.storeListing.findMany({
    where: { id: { in: items.map((item) => item.listingId) }, organizationId: storeId },
    select: {
      id: true,
      status: true,
      sellPrice: true,
      stock: true,
      trackInventory: true,
      organization: { select: { name: true } },
      product: { select: { id: true, name: true, slug: true, sku: true, images: true, status: true, hasVariants: true } },
      storeListingVariants: {
        where: { id: { in: items.flatMap((item) => (item.listingVariantId ? [item.listingVariantId] : [])) } },
        select: {
          id: true,
          status: true,
          sellPrice: true,
          stock: true,
          trackInventory: true,
          variant: {
            select: {
              id: true,
              sku: true,
              images: true,
              status: true,
              variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } },
            },
          },
        },
      },
    },
  })
  const byId = new Map(listings.map((listing) => [listing.id, listing]))

  return items.map((item) => {
    const listing = byId.get(item.listingId)
    if (!listing || listing.status !== Status.PUBLISHED || listing.product.status !== Status.PUBLISHED) {
      throw new OrderItemError("ITEM_UNAVAILABLE", listing?.product.name ?? "An item")
    }
    const { product } = listing

    // A product with variants is sold by variant, and one without by its listing
    if (product.hasVariants !== !!item.listingVariantId) throw new OrderItemError("ITEM_UNAVAILABLE", product.name)

    const row = item.listingVariantId ? listing.storeListingVariants.find((variant) => variant.id === item.listingVariantId) : undefined
    if (item.listingVariantId && (!row || row.status !== Status.PUBLISHED || row.variant.status === Status.ARCHIVED)) {
      throw new OrderItemError("ITEM_UNAVAILABLE", product.name)
    }

    const values = row ? [...row.variant.variantValues].sort((a, b) => a.optionValue.option.position - b.optionValue.option.position) : []
    const variantDescription = values.length ? values.map(({ optionValue }) => `${optionValue.option.name}: ${optionValue.value}`).join(" / ") : null
    const label = variantDescription ? `${product.name} (${variantDescription})` : product.name

    // A variant without its own price sells at the listing's
    const unitPriceUsd = row?.sellPrice ?? listing.sellPrice
    if (unitPriceUsd.lte(0)) throw new OrderItemError("ITEM_UNAVAILABLE", label)

    return {
      listingId: listing.id,
      listingVariantId: row?.id ?? null,
      quantity: item.quantity,
      unitPriceUsd,
      stock: row?.stock ?? listing.stock,
      trackInventory: row?.trackInventory ?? listing.trackInventory,
      productId: product.id,
      productVariantId: row?.variant.id ?? null,
      productName: product.name,
      productSlug: product.slug,
      productImage: row?.variant.images[0] ?? product.images[0] ?? null,
      variantDescription,
      sku: row?.variant.sku ?? product.sku,
      storeName: listing.organization.name,
      label,
    }
  })
}

export interface NewStoreOrder {
  storeId: string
  createdById: string
  customer: { userId: string | null; name: string; email: string | null; phone: string | null }
  shippingMethod: ShippingMethod
  // Null for a pickup
  shipping: { name: string; phone: string; line1: string; line2: string | null; region: string; town: string } | null
  notes: string | null
  discount: { type: "FIXED" | "PERCENTAGE"; value: Prisma.Decimal; reason: string } | null
  rate: { id: string; value: Prisma.Decimal }
  lines: ResolvedLine[]
  priced: PricedOrder
}

// Writes the order in the caller's transaction. Throws OrderItemError when a line's stock ran out, which rolls it back.
export async function createStoreOrder(tx: Tx, order: NewStoreOrder) {
  // Reserved now, so two orders can't sell the same last item. Only rows that track stock, as a cancellation restores.
  for (const line of order.lines) {
    if (!line.trackInventory) continue
    const reserve = { where: { stock: { gte: line.quantity } }, data: { stock: { decrement: line.quantity } } }
    const { count } = line.listingVariantId
      ? await tx.storeListingVariant.updateMany({ ...reserve, where: { ...reserve.where, id: line.listingVariantId } })
      : await tx.storeListing.updateMany({ ...reserve, where: { ...reserve.where, id: line.listingId } })
    if (count === 0) throw new OrderItemError("INSUFFICIENT_STOCK", line.label)
  }

  // BS42-20261017-00042, numbered by a sequence (see its migration)
  const [{ nextval }] = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('order_reference_seq')`
  const reference = `BS42-${formatDate(new Date(), "yyyyMMdd")}-${String(nextval).padStart(5, "0")}`

  const { priced } = order
  return tx.order.create({
    data: {
      reference,
      userId: order.customer.userId,
      customerName: order.customer.name,
      customerEmail: order.customer.email,
      customerPhone: order.customer.phone,
      shippingMethod: order.shippingMethod,
      shippingName: order.shipping?.name ?? null,
      shippingPhone: order.shipping?.phone ?? null,
      shippingLine1: order.shipping?.line1 ?? null,
      shippingLine2: order.shipping?.line2 ?? null,
      shippingRegion: order.shipping?.region ?? null,
      shippingTown: order.shipping?.town ?? null,
      status: OrderStatus.PENDING,
      subtotalUsd: priced.subtotalUsd,
      subtotalGhs: priced.subtotalGhs,
      shippingGhs: priced.shippingGhs,
      taxGhs: priced.taxGhs,
      taxRate: priced.taxRate,
      totalGhs: priced.totalGhs,
      discountType: order.discount?.type ?? null,
      discountValue: order.discount?.value ?? null,
      discountAmountGhs: priced.discountAmountGhs,
      discountReason: order.discount?.reason ?? null,
      exchangeRate: order.rate.value,
      exchangeRateId: order.rate.id,
      createdById: order.createdById,
      notes: order.notes,
      orderItems: {
        create: order.lines.map((line, index) => {
          const amounts = priced.lines[index]!
          return {
            organizationId: order.storeId,
            storeListingId: line.listingId,
            storeListingVariantId: line.listingVariantId,
            quantity: line.quantity,
            unitPriceUsd: amounts.unitPriceUsd,
            totalPriceUsd: amounts.totalPriceUsd,
            unitPriceGhs: amounts.unitPriceGhs,
            totalPriceGhs: amounts.totalPriceGhs,
            discountGhs: amounts.discountGhs,
            taxGhs: amounts.taxGhs,
            productName: line.productName,
            productSlug: line.productSlug,
            productImage: line.productImage,
            variantDescription: line.variantDescription,
            sku: line.sku,
            storeName: line.storeName,
            productId: line.productId,
            productVariantId: line.productVariantId,
          }
        }),
      },
      statusHistory: { create: { status: OrderStatus.PENDING, note: "Created in the store", changedById: order.createdById } },
    },
    select: { id: true, reference: true },
  })
}

export class StatusChangedError extends Error {}

export interface StatusChange {
  orderId: string
  // The status the page showed: nothing changes if the order has moved on since
  from: OrderStatus
  to: OrderStatus
  note: string | null
  changedById: string
  // The order's lines, for putting reserved stock back on a cancellation
  items: { quantity: number; storeListingId: string; storeListingVariantId: string | null; listingTracks: boolean; variantTracks: boolean }[]
}

// Throws StatusChangedError when the order moved on (or, for a cancellation, was paid) since the page loaded
export async function changeOrderStatus(tx: Tx, { orderId, from, to, note, changedById, items }: StatusChange) {
  // Only from the status the page showed, so two people can't both move it on, and never cancelling an order
  // that was paid in the meantime
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: from, ...(to === OrderStatus.CANCELLED && { paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } }) },
    data: { status: to },
  })
  if (count === 0) throw new StatusChangedError()

  await tx.orderStatusHistory.create({ data: { orderId, status: to, note, changedById } })

  // Stock was reserved when the order was made, for the rows that track it, so a cancellation puts it back
  if (to === OrderStatus.CANCELLED) {
    for (const item of items) {
      if (item.storeListingVariantId) {
        if (item.variantTracks) await tx.storeListingVariant.update({ where: { id: item.storeListingVariantId }, data: { stock: { increment: item.quantity } } })
      } else if (item.listingTracks) {
        await tx.storeListing.update({ where: { id: item.storeListingId }, data: { stock: { increment: item.quantity } } })
      }
    }
  }
}
