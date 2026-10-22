import { InstallationStatus, OrderStatus, ShippingMethod } from "@workspace/db/enums"

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
  // Null without installation
  installationStatus: InstallationStatus | null
  installationDate: Date | null
  installationHistory: { id: string; status: InstallationStatus; date: Date | null; note: string | null; createdAt: Date }[]
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

// formatDay names a booked installation day ("Fri 23 Oct")
export function orderTimeline(order: TimelineOrder, formatAmount: (amount: string) => string, formatDay: (date: Date) => string): TimelineStep[] {
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

  // Arranging it starts with the order, and a cancelled order's installation goes with it
  const cancelled = order.status === OrderStatus.CANCELLED
  for (const entry of order.installationHistory) {
    if (entry.status === InstallationStatus.TO_ARRANGE || (cancelled && entry.status === InstallationStatus.CANCELLED)) continue
    const title =
      entry.status === InstallationStatus.BOOKED
        ? `Installation booked for ${entry.date ? formatDay(entry.date) : "a day we've agreed"}`
        : entry.status === InstallationStatus.DONE
          ? "Installed"
          : "Installation cancelled"
    done.push({ key: entry.id, title, at: entry.createdAt, note: entry.note })
  }

  done.sort((a, b) => a.at!.getTime() - b.at!.getTime())

  // Installation still to happen comes last, after delivery
  const installation: TimelineStep[] =
    !cancelled && (order.installationStatus === InstallationStatus.TO_ARRANGE || order.installationStatus === InstallationStatus.BOOKED)
      ? [
          {
            key: "next-installation",
            title:
              order.installationStatus === InstallationStatus.BOOKED && order.installationDate ? `Installation on ${formatDay(order.installationDate)}` : "Installation: we'll call to arrange a day",
            at: null,
            note: null,
          },
        ]
      : []

  // Nothing more to come once it's cancelled, delivered or completed, but the installation
  if (cancelled || order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) return [...done, ...installation]

  // The steps after the furthest one reached, without the optional processing step
  const furthest = Math.max(-1, ...milestones.map((milestone, index) => (reached.has(milestone) ? index : -1)))
  const toCome = milestones
    .slice(furthest + 1)
    .filter((milestone) => milestone !== "PROCESSING" && !reached.has(milestone))
    .map((milestone) => ({ key: `next-${milestone}`, title: milestoneTitle(milestone, pickup), at: null, note: null }))
  return [...done, ...toCome, ...installation]
}
