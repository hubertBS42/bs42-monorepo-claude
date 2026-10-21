import { OrderStatus, ShippingMethod } from "@workspace/db/enums"

// The customer's view of an order's progress: what has happened, oldest first, then the steps still to come. Pure, so
// it can be tested without a database. Notes are the ones the customer's emails already carry (status notes, the
// reasons for a cancellation, refund or return); the note staff wrote when the order was placed is left out.

export interface TimelineStep {
  key: string
  title: string
  at: Date | null // null for a step still to come
  note: string | null
}

export interface TimelineOrder {
  createdAt: Date
  paidAt: Date | null
  status: OrderStatus
  shippingMethod: ShippingMethod
  statusHistory: { id: string; status: OrderStatus; note: string | null; createdAt: Date }[]
  refunds: { id: string; amountGhs: string; reason: string; createdAt: Date; isForReturn: boolean }[]
  returns: { id: string; reason: string; createdAt: Date; refundAmountGhs: string | null }[]
}

type Milestone = "PAID" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED"

function milestoneTitle(milestone: Milestone, pickup: boolean) {
  switch (milestone) {
    case "PAID":
      return "Payment received"
    case "CONFIRMED":
      return "Order confirmed"
    case "PROCESSING":
      return pickup ? "Being got ready for collection" : "Being packed"
    case "SHIPPED":
      return "On its way"
    case "DELIVERED":
      return pickup ? "Collected" : "Delivered"
  }
}

export function orderTimeline(order: TimelineOrder, formatAmount: (amount: string) => string): TimelineStep[] {
  const pickup = order.shippingMethod === ShippingMethod.PICKUP
  // A pickup isn't shipped; processing is a step staff may skip, so it shows only once it has happened
  const milestones: Milestone[] = pickup ? ["PAID", "CONFIRMED", "PROCESSING", "DELIVERED"] : ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]

  const done: TimelineStep[] = [{ key: "placed", title: "Order placed", at: order.createdAt, note: null }]
  const reached = new Set<Milestone>()
  if (order.paidAt) {
    done.push({ key: "paid", title: milestoneTitle("PAID", pickup), at: order.paidAt, note: null })
    reached.add("PAID")
  }

  for (const entry of order.statusHistory) {
    if (entry.status === OrderStatus.PENDING || entry.status === OrderStatus.COMPLETED) continue
    if (entry.status === OrderStatus.CANCELLED) {
      done.push({ key: entry.id, title: "Cancelled", at: entry.createdAt, note: entry.note })
      continue
    }
    const milestone = entry.status as Milestone
    reached.add(milestone)
    done.push({ key: entry.id, title: milestoneTitle(milestone, pickup), at: entry.createdAt, note: entry.note })
  }

  // A return's refund shows with the return
  for (const refund of order.refunds) {
    if (!refund.isForReturn) done.push({ key: refund.id, title: `Refunded ${formatAmount(refund.amountGhs)}`, at: refund.createdAt, note: refund.reason })
  }
  for (const item of order.returns) {
    const title = item.refundAmountGhs ? `Return received, ${formatAmount(item.refundAmountGhs)} refunded` : "Return received"
    done.push({ key: item.id, title, at: item.createdAt, note: item.reason })
  }

  done.sort((a, b) => a.at!.getTime() - b.at!.getTime())

  // Nothing more to come once it's cancelled, delivered or completed
  if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) return done

  // The steps after the furthest one reached, without the optional processing step
  const furthest = Math.max(-1, ...milestones.map((milestone, index) => (reached.has(milestone) ? index : -1)))
  const toCome = milestones
    .slice(furthest + 1)
    .filter((milestone) => milestone !== "PROCESSING" && !reached.has(milestone))
    .map((milestone) => ({ key: `next-${milestone}`, title: milestoneTitle(milestone, pickup), at: null, note: null }))
  return [...done, ...toCome]
}
