import "server-only"

import type { prisma } from "@workspace/db"
import { CollectionTransferStatus, OrderStatus, ShippingMethod } from "@workspace/db/enums"

// Bringing a pickup order's items to the branch it's collected at, from the branches that sold them: a store sends all
// its lines on the order at once, the collecting branch receives them, and the order can be marked ready once every
// other store's have arrived. Stock doesn't change (the order already holds it), but a line that arrives at a branch
// listing the same product and variant is held there (OrderItem.heldListingId), so a cancellation or a restocked return
// puts it back where it is. In its own module, with relative imports, so it can be tested against the database.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type Client = typeof prisma | Tx

const MESSAGES = {
  NOT_FOUND: "That order or delivery wasn't found.",
  NOT_FOR_COLLECTION: "This order isn't collected at another branch.",
  NOTHING_TO_SEND: "This store has nothing on the order to send.",
  ORDER_CLOSED: "This order is finished or cancelled, so nothing needs sending.",
  ALREADY_SENT: "These items have already been sent. Refresh the page.",
  NOT_ON_THE_WAY: "These items aren't on their way any more. Refresh the page.",
  NOT_ARRIVED: "Some items haven't arrived at the collecting branch yet.",
}

export class CollectionError extends Error {
  readonly code: keyof typeof MESSAGES

  constructor(code: keyof typeof MESSAGES) {
    super(MESSAGES[code])
    this.code = code
  }
}

const CLOSED: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.DELIVERED, OrderStatus.COMPLETED]
const ACTIVE: CollectionTransferStatus[] = [CollectionTransferStatus.SENT, CollectionTransferStatus.RECEIVED]

// The order's collecting store, and the other stores whose lines it has
async function loadCollection(tx: Client, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      shippingMethod: true,
      pickupLocation: { select: { organizationId: true } },
      orderItems: { select: { id: true, organizationId: true, storeListing: { select: { productId: true } }, storeListingVariant: { select: { variantId: true } } } },
      collectionTransfers: { where: { status: { in: ACTIVE } }, select: { fromStoreId: true, status: true } },
    },
  })
  if (!order) throw new CollectionError("NOT_FOUND")
  if (order.shippingMethod !== ShippingMethod.PICKUP || !order.pickupLocation) throw new CollectionError("NOT_FOR_COLLECTION")
  return { ...order, collectingStoreId: order.pickupLocation.organizationId }
}

// Sends every line of fromStoreId's on the order to the collecting branch
export async function sendForCollection(tx: Tx, { orderId, fromStoreId, userId }: { orderId: string; fromStoreId: string; userId: string }) {
  await tx.$queryRaw`SELECT 1 FROM "order" WHERE "id" = ${orderId}::uuid FOR UPDATE`
  const order = await loadCollection(tx, orderId)
  if (fromStoreId === order.collectingStoreId || !order.orderItems.some((line) => line.organizationId === fromStoreId)) throw new CollectionError("NOTHING_TO_SEND")
  if (CLOSED.includes(order.status)) throw new CollectionError("ORDER_CLOSED")
  if (order.collectionTransfers.some((transfer) => transfer.fromStoreId === fromStoreId)) throw new CollectionError("ALREADY_SENT")
  return tx.collectionTransfer.create({ data: { orderId, fromStoreId, sentById: userId }, select: { id: true } })
}

// The collecting branch has them: each line is held at its listing of the same product and variant, when it has one
export async function receiveForCollection(tx: Tx, { transferId, userId }: { transferId: string; userId: string }) {
  await tx.$queryRaw`SELECT 1 FROM "collection_transfer" WHERE "id" = ${transferId}::uuid FOR UPDATE`
  const transfer = await tx.collectionTransfer.findUnique({ where: { id: transferId }, select: { orderId: true, fromStoreId: true, status: true } })
  if (!transfer) throw new CollectionError("NOT_FOUND")
  if (transfer.status !== CollectionTransferStatus.SENT) throw new CollectionError("NOT_ON_THE_WAY")
  const order = await loadCollection(tx, transfer.orderId)

  await tx.collectionTransfer.update({ where: { id: transferId }, data: { status: CollectionTransferStatus.RECEIVED, receivedById: userId, receivedAt: new Date() } })
  for (const line of order.orderItems.filter((item) => item.organizationId === transfer.fromStoreId)) {
    const listing = await tx.storeListing.findUnique({
      where: { organizationId_productId: { organizationId: order.collectingStoreId, productId: line.storeListing.productId } },
      select: { id: true, storeListingVariants: { select: { id: true, variantId: true } } },
    })
    if (!listing) continue
    const variant = line.storeListingVariant ? listing.storeListingVariants.find((row) => row.variantId === line.storeListingVariant!.variantId) : null
    if (line.storeListingVariant && !variant) continue
    await tx.orderItem.update({ where: { id: line.id }, data: { heldListingId: listing.id, heldListingVariantId: variant?.id ?? null } })
  }
  return { orderId: transfer.orderId, collectingStoreId: order.collectingStoreId }
}

// Sent by mistake: called back before it arrives
export async function cancelCollectionSend(tx: Tx, { transferId, userId }: { transferId: string; userId: string }) {
  const { count } = await tx.collectionTransfer.updateMany({
    where: { id: transferId, status: CollectionTransferStatus.SENT },
    data: { status: CollectionTransferStatus.CANCELLED, cancelledById: userId, cancelledAt: new Date() },
  })
  if (count === 0) throw new CollectionError("NOT_ON_THE_WAY")
}

// Whether everything is at the collecting branch: its own lines, and every other store's received. True for an
// order that isn't collected at a chosen location.
export async function allAtCollectingBranch(client: Client, orderId: string) {
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: {
      pickupLocation: { select: { organizationId: true } },
      orderItems: { select: { organizationId: true } },
      collectionTransfers: { where: { status: CollectionTransferStatus.RECEIVED }, select: { fromStoreId: true } },
    },
  })
  if (!order?.pickupLocation) return true
  const arrived = new Set([order.pickupLocation.organizationId, ...order.collectionTransfers.map((transfer) => transfer.fromStoreId)])
  return order.orderItems.every((line) => arrived.has(line.organizationId))
}
