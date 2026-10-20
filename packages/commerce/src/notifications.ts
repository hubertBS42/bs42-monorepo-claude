import "server-only"

import { authURLs } from "@workspace/auth/constants"
import type { AppSettingsData } from "@workspace/contracts"
import { prisma, readAppSettings, resolveConsoleName } from "@workspace/db"
import { sendEmail, StaffAlertEmail } from "@workspace/email"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"

// Staff notifications: emails to the addresses in Settings → Notifications, one switch per event. Callers schedule
// them with after(), once the change has committed, and they never throw: a missing mailer or a bad address is logged,
// not raised into a request that already succeeded.

type Alert = { subject: string; preview: string; heading: string; intro: string; details: { label: string; value: string }[]; action?: { label: string; url: string } }

const ghs = (amount: { toString(): string }) => formatCurrency(amount.toString(), "GHS", "en-GH")

async function send(settings: AppSettingsData, alert: Alert, context: string) {
  const appName = resolveConsoleName(settings)
  const results = await Promise.allSettled(
    settings.notificationEmails.map((to) =>
      sendEmail({
        to,
        fromName: appName,
        subject: alert.subject,
        reactTemplate: StaffAlertEmail({ ...alert, action: alert.action ?? null, appName, logoUrl: settings.logoUrl }),
      })
    )
  )
  for (const result of results) {
    if (result.status === "rejected") console.error(`Could not send the ${context} notification:`, result.reason)
  }
}

// An order customers placed on the storefront, or staff created in a store's workspace
export async function notifyNewOrder(orderId: string, source: "storefront" | "staff") {
  try {
    const settings = await readAppSettings()
    const enabled = source === "storefront" ? settings.notifyStorefrontOrders : settings.notifyStaffOrders
    if (!enabled || settings.notificationEmails.length === 0) return

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        reference: true,
        customerName: true,
        totalGhs: true,
        shippingMethod: true,
        createdBy: { select: { name: true } },
        orderItems: { select: { quantity: true, storeName: true } },
      },
    })
    if (!order) return

    const stores = [...new Set(order.orderItems.map((item) => item.storeName))]
    const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
    const placedBy = source === "storefront" ? "A customer placed an order on the storefront." : `${order.createdBy?.name ?? "Staff"} created an order in ${stores.join(", ")}.`

    await send(
      settings,
      {
        subject: `New order ${order.reference}`,
        preview: `${order.customerName} · ${ghs(order.totalGhs)}`,
        heading: "New order",
        intro: placedBy,
        details: [
          { label: "Reference", value: order.reference },
          { label: "Customer", value: order.customerName },
          { label: stores.length > 1 ? "Stores" : "Store", value: stores.join(", ") },
          { label: "Items", value: String(itemCount) },
          { label: "Total", value: ghs(order.totalGhs) },
          { label: "Fulfilment", value: order.shippingMethod === "DELIVERY" ? "Delivery" : "Pickup" },
        ],
        action: { label: "View order", url: new URL(`/orders/${orderId}/details`, authURLs.console).toString() },
      },
      "new order"
    )
  } catch (error) {
    console.error(`New order notification for ${orderId} failed:`, error)
  }
}

export interface StockAlert {
  kind: "low" | "out"
  storeName: string
  // "Tee (Size: M)"
  label: string
  stock: number
  threshold: number
}

// Items a sale took down to their low-stock threshold, or to 0: one email for the lot, so an order selling several
// items sends one, not one per item
export async function notifyStockAlerts(alerts: StockAlert[]) {
  try {
    if (alerts.length === 0) return
    const settings = await readAppSettings()
    if (settings.notificationEmails.length === 0) return

    const wanted = alerts.filter((alert) => (alert.kind === "out" ? settings.notifyOutOfStock : settings.notifyLowStock))
    if (wanted.length === 0) return

    const anyOut = wanted.some((alert) => alert.kind === "out")
    const heading = anyOut ? "Out of stock" : "Low stock"
    await send(
      settings,
      {
        subject: wanted.length === 1 ? `${heading}: ${wanted[0]!.label}` : `${heading}: ${wanted.length} items`,
        preview: wanted.map((alert) => alert.label).join(", "),
        heading,
        intro: `A sale left ${wanted.length === 1 ? "this item" : "these items"} needing restocking.`,
        details: wanted.map((alert) => ({
          label: `${alert.label} (${alert.storeName})`,
          value: alert.kind === "out" ? "out of stock" : `${alert.stock} left (alert at ${alert.threshold})`,
        })),
      },
      "stock"
    )
  } catch (error) {
    console.error("Stock notification failed:", error)
  }
}

// A store's owner or admin gave money back on one of its orders, on its own or with a return. Refunds by the
// platform's superAdmins don't notify. Never more than one per refund, so no batching.
export async function notifyStoreRefund(orderId: string, storeId: string, refund: { amountGhs: string; reason: string; givenById: string; kind: "refund" | "cancel" | "return" }) {
  try {
    const settings = await readAppSettings()
    if (!settings.notifyStoreRefunds || settings.notificationEmails.length === 0) return

    const [order, store, givenBy] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId }, select: { reference: true, customerName: true, totalGhs: true } }),
      prisma.organization.findUnique({ where: { id: storeId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: refund.givenById }, select: { name: true } }),
    ])
    if (!order) return

    const what = refund.kind === "cancel" ? "cancelled and refunded" : refund.kind === "return" ? "recorded a return and refunded" : "refunded"
    await send(
      settings,
      {
        subject: `${store?.name ?? "A store"} refunded ${ghs(refund.amountGhs)} on ${order.reference}`,
        preview: refund.reason,
        heading: "Refund given by a store",
        intro: `${givenBy?.name ?? "Staff"} ${what} an order in ${store?.name ?? "a store"}.`,
        details: [
          { label: "Reference", value: order.reference },
          { label: "Customer", value: order.customerName },
          { label: "Refunded", value: ghs(refund.amountGhs) },
          { label: "Order total", value: ghs(order.totalGhs) },
          { label: "Reason", value: refund.reason },
        ],
        action: { label: "View order", url: new URL(`/orders/${orderId}/details`, authURLs.console).toString() },
      },
      "store refund"
    )
  } catch (error) {
    console.error(`Store refund notification for ${orderId} failed:`, error)
  }
}

// The daily exchange-rate fetch failed. The last rate stays usable for a while, then orders stop until one is set.
export async function notifyRateFetchFailed(date: string, error: string) {
  try {
    const settings = await readAppSettings()
    if (!settings.notifyRateFetchFailure || settings.notificationEmails.length === 0) return

    const day = formatDate(`${date}T12:00:00Z`, "MMM d, yyyy")
    await send(
      settings,
      {
        subject: `Exchange rate for ${day} wasn't fetched`,
        preview: error,
        heading: "Exchange rate not fetched",
        intro: `Today's USD→GHS rate couldn't be fetched automatically. Orders use the last rate until it's too old, so set today's in Settings.`,
        details: [
          { label: "Day", value: day },
          { label: "Reason", value: error },
        ],
        action: { label: "Open Settings", url: new URL("/settings", authURLs.console).toString() },
      },
      "exchange rate"
    )
  } catch (failure) {
    console.error("Exchange rate notification failed:", failure)
  }
}
