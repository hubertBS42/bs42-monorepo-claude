import "server-only"

import { authURLs } from "@workspace/auth/constants"
import type { AppSettingsData } from "@workspace/contracts"
import { prisma, readAppSettings, resolveConsoleName } from "@workspace/db"
import { sendEmail, StaffAlertEmail } from "@workspace/email"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import { BUSINESS_TYPE_LABELS } from "./trade-account-status"

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
        installationGhs: true,
        createdBy: { select: { name: true } },
        orderItems: { select: { quantity: true, storeName: true, installationUnitGhs: true } },
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
          // The platform's installers are needed: someone has to call the customer
          ...(order.installationGhs.gt(0)
            ? [
                {
                  label: "Installation",
                  value: `${order.orderItems.filter((item) => item.installationUnitGhs).reduce((sum, item) => sum + item.quantity, 0)} items, ${ghs(order.installationGhs)}: to arrange`,
                },
              ]
            : []),
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

// A customer posted a 1 or 2 star review (an edit down to one counts too), so staff can look into what went wrong,
// or hide it if it breaks the rules
export async function notifyLowRating(reviewId: string) {
  try {
    const settings = await readAppSettings()
    if (!settings.notifyLowRatings || settings.notificationEmails.length === 0) return

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { rating: true, title: true, body: true, variantLabel: true, productId: true, product: { select: { name: true } }, user: { select: { name: true, email: true } } },
    })
    if (!review) return

    await send(
      settings,
      {
        subject: `${review.rating}★ review of ${review.product.name}`,
        preview: review.title,
        heading: "Low rating",
        intro: `A customer rated ${review.product.name} ${review.rating} out of 5.`,
        details: [
          { label: "Product", value: review.variantLabel ? `${review.product.name} (${review.variantLabel})` : review.product.name },
          { label: "Customer", value: review.user.name ? `${review.user.name} (${review.user.email})` : review.user.email },
          { label: "Rating", value: `${review.rating} / 5` },
          { label: "Title", value: review.title },
          { label: "Review", value: review.body },
        ],
        action: { label: "View reviews", url: new URL(`/catalogue/reviews?product=${review.productId}`, authURLs.console).toString() },
      },
      "low rating"
    )
  } catch (error) {
    console.error(`Low rating notification for ${reviewId} failed:`, error)
  }
}

// A business applied for a trade account on the storefront (again, after a rejection), for an admin to review
export async function notifyTradeApplication(accountId: string) {
  try {
    const settings = await readAppSettings()
    if (!settings.notifyTradeApplications || settings.notificationEmails.length === 0) return

    const account = await prisma.tradeAccount.findUnique({
      where: { id: accountId },
      select: { companyName: true, registrationNumber: true, tin: true, phone: true, businessType: true, details: true, user: { select: { name: true, email: true } } },
    })
    if (!account) return

    await send(
      settings,
      {
        subject: `Trade account application: ${account.companyName}`,
        preview: `${account.companyName} · ${BUSINESS_TYPE_LABELS[account.businessType]}`,
        heading: "Trade account application",
        intro: `${account.companyName} applied for a trade account. Approve it with a discount, or reject it with a reason.`,
        details: [
          { label: "Company", value: account.companyName },
          { label: "Business", value: BUSINESS_TYPE_LABELS[account.businessType] },
          { label: "Registration number", value: account.registrationNumber },
          { label: "TIN", value: account.tin },
          { label: "Contact", value: `${account.user.name ? `${account.user.name}, ` : ""}${account.user.email}, ${account.phone}` },
          ...(account.details ? [{ label: "About the business", value: account.details }] : []),
        ],
        action: { label: "Review the application", url: new URL(`/trade-accounts/${accountId}`, authURLs.console).toString() },
      },
      "trade application"
    )
  } catch (error) {
    console.error(`Trade application notification for ${accountId} failed:`, error)
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

// Money Paystack took that an order couldn't simply take. Always sent (no switch): someone has to give it back.
export type PaymentProblem = "ORDER_CANCELLED" | "PAID_TWICE" | "AMOUNT_MISMATCH"

const PAYMENT_PROBLEMS: Record<PaymentProblem, { heading: string; intro: string }> = {
  ORDER_CANCELLED: {
    heading: "Payment for a cancelled order",
    intro:
      "A customer paid for an order after it was cancelled for going unpaid, and its stock was put back. The payment is recorded on the order: refund it in Paystack, then record the refund on the order.",
  },
  PAID_TWICE: {
    heading: "Order paid twice",
    intro: "A customer paid for an order that was already paid. Refund this payment in Paystack. The order only counts the first payment, so don't record this refund on it.",
  },
  AMOUNT_MISMATCH: {
    heading: "Payment doesn't match the order",
    intro: "Paystack took an amount that isn't the order's total, so the order wasn't marked as paid. Check the payment in Paystack, then refund it or record the payment on the order by hand.",
  },
}

export async function notifyPaymentProblem(orderId: string, problem: PaymentProblem, paystackReference: string, amountGhs: string) {
  try {
    const settings = await readAppSettings()
    if (settings.notificationEmails.length === 0) {
      console.error(`Payment problem (${problem}) on order ${orderId}, Paystack reference ${paystackReference}, and no one to tell`)
      return
    }
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { reference: true, customerName: true, totalGhs: true } })
    if (!order) return

    const { heading, intro } = PAYMENT_PROBLEMS[problem]
    await send(
      settings,
      {
        subject: `${heading}: ${order.reference}`,
        preview: `${order.customerName} · ${ghs(amountGhs)}`,
        heading,
        intro,
        details: [
          { label: "Order", value: order.reference },
          { label: "Customer", value: order.customerName },
          { label: "Order total", value: ghs(order.totalGhs) },
          { label: "Paid", value: ghs(amountGhs) },
          { label: "Paystack reference", value: paystackReference },
        ],
        action: { label: "View order", url: new URL(`/orders/${orderId}/details`, authURLs.console).toString() },
      },
      "payment problem"
    )
  } catch (error) {
    console.error(`Payment problem notification for ${orderId} failed:`, error)
  }
}
