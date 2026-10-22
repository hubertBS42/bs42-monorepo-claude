import "server-only"

import type { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { OrderStatus, ReviewStatus } from "@workspace/db/enums"
import { accountOrdersWhere } from "./customer-orders"

// Product reviews. Only buyers review: a customer can review a product once one of their account's orders with it
// (accountOrdersWhere) has been delivered or completed, and not all of it came back. One review per customer per
// product, whichever store sold it. Reviews are published at once; staff can hide one. Product.rating and numReviews
// count the published ones and are recomputed by every change here, with the product row locked so two changes
// can't both write a count that misses the other. In their own module so they can be tested against the database.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx

export interface ReviewCustomer {
  id: string
  email: string
  emailVerified: boolean
}

export interface ReviewInput {
  rating: number
  title: string
  body: string
}

export class ReviewError extends Error {
  readonly code: "NOT_ELIGIBLE" | "NOT_FOUND" | "STATUS_CHANGED"

  constructor(code: "NOT_ELIGIBLE" | "NOT_FOUND" | "STATUS_CHANGED", message: string) {
    super(message)
    this.code = code
  }
}

// A rating at or below this one alerts staff (notifyLowRating)
export const LOW_RATING = 2

// An order's lines count once it has reached the customer
const RECEIVED = [OrderStatus.DELIVERED, OrderStatus.COMPLETED]

// The customer's order lines that let them review, newest first: received, and not every unit returned
async function reviewablePurchases(client: Client, customer: ReviewCustomer, productIds?: string[]) {
  const lines = await client.orderItem.findMany({
    where: {
      productId: productIds ? { in: productIds } : { not: null },
      order: { AND: [accountOrdersWhere(customer), { status: { in: RECEIVED } }] },
    },
    orderBy: { order: { createdAt: "desc" } },
    select: {
      id: true,
      productId: true,
      quantity: true,
      variantDescription: true,
      order: { select: { createdAt: true } },
      returns: { select: { quantity: true } },
    },
  })
  return lines.filter((line) => line.returns.reduce((sum, item) => sum + item.quantity, 0) < line.quantity)
}

// Raw SQL: Prisma has no SELECT … FOR UPDATE
async function lockProduct(tx: Tx, productId: string) {
  await tx.$queryRaw`SELECT 1 FROM "product" WHERE "id" = ${productId}::uuid FOR UPDATE`
}

// The product's published reviews' average, to two places, and count
export async function recomputeProductRating(tx: Tx, productId: string) {
  const { _avg, _count } = await tx.review.aggregate({ where: { productId, status: ReviewStatus.PUBLISHED }, _avg: { rating: true }, _count: true })
  const rating = _avg.rating === null ? new Prisma.Decimal(0) : new Prisma.Decimal(_avg.rating).toDecimalPlaces(2)
  await tx.product.update({ where: { id: productId }, data: { rating, numReviews: _count } })
}

// Products the customer has bought and can review but hasn't yet, the latest purchase first, with the variant they
// bought as the order line named it
export async function productsToReview(client: Client, customer: ReviewCustomer) {
  const [lines, reviewed] = await Promise.all([reviewablePurchases(client, customer), client.review.findMany({ where: { userId: customer.id }, select: { productId: true } })])
  const done = new Set(reviewed.map((review) => review.productId))
  const latest = new Map<string, (typeof lines)[number]>()
  for (const line of lines) if (!done.has(line.productId!) && !latest.has(line.productId!)) latest.set(line.productId!, line)
  if (!latest.size) return []

  const products = await client.product.findMany({ where: { id: { in: [...latest.keys()] } }, select: { id: true, name: true, slug: true, images: true } })
  const byId = new Map(products.map((product) => [product.id, product]))
  return [...latest.values()].flatMap((line) => {
    const product = byId.get(line.productId!)
    return product ? [{ ...product, image: product.images[0] ?? null, variantLabel: line.variantDescription, boughtOn: line.order.createdAt }] : []
  })
}

// Whether the customer may review the product now (or already has: then they can edit it)
export async function canReview(client: Client, customer: ReviewCustomer, productId: string) {
  const existing = await client.review.count({ where: { userId: customer.id, productId } })
  if (existing) return true
  return (await reviewablePurchases(client, customer, [productId])).length > 0
}

// Writes the customer's review of the product, or changes the one they wrote. A new one needs a purchase that lets
// them review (NOT_ELIGIBLE otherwise) and records it. Editing doesn't publish a review staff hid. `lowered` says
// whether it's now a 1 or 2 star review that wasn't one before, for the staff alert.
export async function saveReview(tx: Tx, customer: ReviewCustomer, productId: string, input: ReviewInput) {
  await lockProduct(tx, productId)
  const existing = await tx.review.findUnique({ where: { userId_productId: { userId: customer.id, productId } }, select: { id: true, rating: true } })

  let review: { id: string; status: ReviewStatus }
  if (existing) {
    review = await tx.review.update({ where: { id: existing.id }, data: input, select: { id: true, status: true } })
  } else {
    const [purchase] = await reviewablePurchases(tx, customer, [productId])
    if (!purchase) throw new ReviewError("NOT_ELIGIBLE", "You can review a product once an order with it has reached you.")
    review = await tx.review.create({
      data: { ...input, userId: customer.id, productId, orderItemId: purchase.id, variantLabel: purchase.variantDescription },
      select: { id: true, status: true },
    })
  }

  await recomputeProductRating(tx, productId)
  const published = review.status === ReviewStatus.PUBLISHED
  return { id: review.id, created: !existing, published, lowered: published && input.rating <= LOW_RATING && (!existing || existing.rating > LOW_RATING) }
}

// Removes the customer's review of the product, if they wrote one
export async function deleteReview(tx: Tx, customerId: string, productId: string) {
  await lockProduct(tx, productId)
  const { count } = await tx.review.deleteMany({ where: { userId: customerId, productId } })
  if (count) await recomputeProductRating(tx, productId)
  return count > 0
}

// Staff hide a review (with the reason its author is shown) or publish it again. Only from the status the page
// showed (STATUS_CHANGED), so two people can't undo each other.
export async function setReviewStatus(tx: Tx, reviewId: string, change: { from: ReviewStatus; to: ReviewStatus; reason: string | null; changedById: string }) {
  const review = await tx.review.findUnique({ where: { id: reviewId }, select: { productId: true } })
  if (!review) throw new ReviewError("NOT_FOUND", "This review was deleted by its author.")
  await lockProduct(tx, review.productId)

  const hidden = change.to === ReviewStatus.HIDDEN
  const { count } = await tx.review.updateMany({
    where: { id: reviewId, status: change.from },
    data: hidden
      ? { status: change.to, hiddenReason: change.reason, hiddenAt: new Date(), hiddenById: change.changedById }
      : { status: change.to, hiddenReason: null, hiddenAt: null, hiddenById: null },
  })
  if (!count) throw new ReviewError("STATUS_CHANGED", "Someone else changed this review. Refresh the page.")

  await recomputeProductRating(tx, review.productId)
}

// The products on an order its customer can still review, for the "How was it?" email: the account the order belongs
// to (signed in, or the verified owner of its email) leaves out what it has reviewed. A guest without an account
// gets every product; the email's links ask them to sign in.
export async function unreviewedOrderProducts(client: Client, orderId: string) {
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      customerEmail: true,
      orderItems: { orderBy: { id: "asc" }, select: { productId: true, quantity: true, returns: { select: { quantity: true } } } },
    },
  })
  if (!order) return []

  const account = order.userId
    ? { id: order.userId }
    : order.customerEmail
      ? await client.user.findFirst({ where: { email: { equals: order.customerEmail, mode: "insensitive" }, emailVerified: true }, select: { id: true } })
      : null
  const reviewed = account ? new Set((await client.review.findMany({ where: { userId: account.id }, select: { productId: true } })).map((review) => review.productId)) : new Set<string>()

  const ids = [
    ...new Set(order.orderItems.filter((line) => line.productId && line.returns.reduce((sum, item) => sum + item.quantity, 0) < line.quantity).flatMap((line) => line.productId ?? [])),
  ].filter((id) => !reviewed.has(id))
  if (!ids.length) return []

  const products = await client.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true, images: true } })
  const byId = new Map(products.map((product) => [product.id, product]))
  return ids.flatMap((id) => {
    const product = byId.get(id)
    return product ? [{ id, name: product.name, slug: product.slug, image: product.images[0] ?? null }] : []
  })
}
