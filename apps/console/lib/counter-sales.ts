import "server-only"

import { changeOrderStatus, createOrder, type NewOrder } from "@workspace/commerce/order-writes"
import type { prisma } from "@workspace/db"
import { OrderStatus, PaymentStatus, ShippingMethod, type PaymentMethod } from "@workspace/db/enums"

// A sale at the store's counter: the customer has paid and leaves with the goods, so it's created, paid and completed
// at once, and nothing is left half done if one step fails. It's an ordinary order from then on, so reports, refunds
// and returns treat it like any other. In its own module, with relative imports, so it can be tested against the
// database.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export const COUNTER_SALE_NOTE = "Counter sale"

export type NewCounterSale = Omit<NewOrder, "statusNote" | "shippingMethod" | "shipping" | "paymentMethod" | "notes"> & { createdById: string; paymentMethod: PaymentMethod }

// Runs in the caller's transaction. Throws OrderItemError when a line can't be sold or has run out, which rolls it back.
export async function completeCounterSale(tx: Tx, sale: NewCounterSale) {
  const order = await createOrder(tx, { ...sale, statusNote: COUNTER_SALE_NOTE, shippingMethod: ShippingMethod.PICKUP, shipping: null, notes: null })

  await tx.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.PAID, paidAt: new Date(), paymentRecordedById: sale.createdById } })
  await changeOrderStatus(tx, { orderId: order.id, from: OrderStatus.PENDING, to: OrderStatus.COMPLETED, note: "Paid and collected at the counter", changedById: sale.createdById, items: [] })

  return order
}
