import "server-only"

import { authURLs } from "@workspace/auth/constants"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { PLATFORM_ALERTS, PLATFORM_ORGANIZATION_SLUG, type AppSettingsData, type PlatformAlertKey } from "@workspace/contracts"
import { prisma, readAppSettings, resolveConsoleName } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { NotificationKind } from "@workspace/db/enums"
import { sendEmail, StaffAlertEmail } from "@workspace/email"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import { BUSINESS_TYPE_LABELS } from "./trade-account-status"

// Staff notifications, each an email and a notification in the console's bell (the Notification table):
// - the platform's: emails to the addresses in Settings → Notifications, by Settings' switch for the event, and the
//   bell of every platform admin, by each admin's own switch (PLATFORM_ALERTS, PlatformAlertSetting);
// - a store's own: its owners and admins, each with their own switches per store (Member.notifyOrders and the rest).
// Whoever made the change isn't told about it. Callers schedule these with after(), once the change has committed, and
// they never throw: a missing mailer or a bad address is logged, not raised into a request that already succeeded.

// action.path is a console path with ?workspace=, which has the console switch to the store (or the platform) the
// page belongs to first (proxy.ts), for someone signed in to another
type Alert = { subject: string; preview: string; heading: string; intro: string; details: { label: string; value: string }[]; action: { label: string; path: string } | null }

const ghs = (amount: { toString(): string }) => formatCurrency(amount.toString(), "GHS", "en-GH")

async function sendEmails(settings: AppSettingsData, alert: Alert, context: string, recipients: string[]) {
  const appName = resolveConsoleName(settings)
  const action = alert.action && { label: alert.action.label, url: new URL(alert.action.path, authURLs.console).toString() }
  const results = await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({
        to,
        fromName: appName,
        subject: alert.subject,
        reactTemplate: StaffAlertEmail({ ...alert, action, appName, logoUrl: settings.logoUrl }),
      })
    )
  )
  for (const result of results) {
    if (result.status === "rejected") console.error(`Could not send the ${context} notification:`, result.reason)
  }
}

// The bell shows the email's subject and preview, and opens the email's page, or else href
async function addNotifications(userIds: string[], kind: NotificationKind, alert: Alert, href: string) {
  if (userIds.length === 0) return
  await prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, kind, title: alert.subject, body: alert.preview, href: alert.action?.path ?? href })) })
}

const notBanned = { OR: [{ banned: null }, { banned: false }] }

// The platform organization's id never changes
let platformId: string | undefined
async function platformWorkspaceId() {
  platformId ??= (await prisma.organization.findUnique({ where: { slug: PLATFORM_ORGANIZATION_SLUG }, select: { id: true } }))?.id
  return platformId
}

const inWorkspace = (path: string, workspaceId: string | undefined) => {
  if (!workspaceId) return path
  const url = new URL(path, authURLs.console)
  url.searchParams.set("workspace", workspaceId)
  return `${url.pathname}${url.search}`
}

// What a platform notice says, given which of its alerts the reader wants: most have one alert, and say nothing
// when it isn't wanted; a stock notice lists only the kinds (low, out) its reader wants, or says nothing
type PlatformContent = Omit<Alert, "action"> | ((wants: (alert: PlatformAlertKey) => boolean) => Omit<Alert, "action"> | null)

const settingsWant = (settings: AppSettingsData) => (alert: PlatformAlertKey) => settings[PLATFORM_ALERTS.find((item) => item.alert === alert)!.settingsKey]

// To the platform: Settings' addresses when Settings' switch for one of alerts is on, and the bell of every platform
// admin (admins and superAdmins) but exceptUserId whose own switch is (PlatformAlertSetting, else the alert's
// default). No alerts (payment problems): always. path is a page in the global workspace.
async function toPlatform(
  settings: AppSettingsData,
  kind: NotificationKind,
  alerts: PlatformAlertKey[],
  content: PlatformContent,
  action: { label: string; path: string } | null,
  context: string,
  exceptUserId: string | null = null
) {
  const workspaceId = await platformWorkspaceId()
  const withAction = (alert: Omit<Alert, "action">): Alert => ({ ...alert, action: action && { ...action, path: inWorkspace(action.path, workspaceId) } })
  const contentFor = (wants: (alert: PlatformAlertKey) => boolean) => {
    if (alerts.length && !alerts.some(wants)) return null
    return typeof content === "function" ? content(wants) : content
  }

  // Role strings can be comma-separated: contains narrows the rows, hasSystemRole decides
  const staff = await prisma.user.findMany({
    where: { AND: [{ OR: consoleAdminRoles.map((role) => ({ role: { contains: role } })) }, notBanned], ...(exceptUserId && { id: { not: exceptUserId } }) },
    select: { id: true, role: true, platformAlertSettings: { where: { alert: { in: alerts } }, select: { alert: true, bell: true } } },
  })

  // Admins who want the same alerts get the same notice
  const groups = new Map<string, { wants: (alert: PlatformAlertKey) => boolean; userIds: string[] }>()
  for (const user of staff.filter((user) => hasSystemRole(user.role, consoleAdminRoles))) {
    const own = new Map(user.platformAlertSettings.map((row) => [row.alert, row.bell]))
    const wants = (alert: PlatformAlertKey) => own.get(alert) ?? PLATFORM_ALERTS.find((item) => item.alert === alert)!.default
    const key = alerts.map((alert) => (wants(alert) ? 1 : 0)).join("")
    const group = groups.get(key) ?? { wants, userIds: [] }
    group.userIds.push(user.id)
    groups.set(key, group)
  }
  for (const { wants, userIds } of groups.values()) {
    const alert = contentFor(wants)
    // Without a page of its own (stock alerts across stores), the platform's dashboard, which lists them
    if (alert) await addNotifications(userIds, kind, withAction(alert), inWorkspace("/", workspaceId))
  }

  const emailed = contentFor(settingsWant(settings))
  if (emailed) await sendEmails(settings, withAction(emailed), context, settings.notificationEmails)
}

type StorePreference = "notifyOrders" | "notifyStock" | "notifyRefunds"

// To a store's owners and admins who want this kind, but exceptUserId, and not platform staff: they belong to every
// store, and get the platform's instead. path is a page in the store's workspace.
async function toStoreTeam(
  settings: AppSettingsData,
  storeId: string,
  preference: StorePreference,
  kind: NotificationKind,
  alert: Omit<Alert, "action">,
  action: { label: string; path: string },
  context: string,
  exceptUserId: string | null = null
) {
  const members = await prisma.member.findMany({
    where: {
      organizationId: storeId,
      role: { in: ["owner", "admin"] },
      [preference]: true,
      user: { ...notBanned, ...(exceptUserId && { id: { not: exceptUserId } }) },
    },
    select: { user: { select: { id: true, email: true, role: true } } },
  })
  const team = members.map((member) => member.user).filter((user) => !hasSystemRole(user.role, consoleAdminRoles))
  if (team.length === 0) return
  const full = { ...alert, action: { ...action, path: inWorkspace(action.path, storeId) } }
  await addNotifications(
    team.map((user) => user.id),
    kind,
    full,
    full.action.path
  )
  await sendEmails(
    settings,
    full,
    context,
    team.map((user) => user.email)
  )
}

// What a store's lines come to, as its orders list counts them: after their discount, with their tax
type StoreLine = { totalPriceGhs: Prisma.Decimal; discountGhs: Prisma.Decimal; taxGhs: Prisma.Decimal }
const sumLines = (lines: StoreLine[]) => lines.reduce((sum, line) => sum.plus(line.totalPriceGhs.minus(line.discountGhs).plus(line.taxGhs)), new Prisma.Decimal(0))

// An order customers placed on the storefront, or staff created in a store's workspace
export async function notifyNewOrder(orderId: string, source: "storefront" | "staff") {
  try {
    const settings = await readAppSettings()
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        reference: true,
        customerName: true,
        totalGhs: true,
        shippingMethod: true,
        installationGhs: true,
        createdById: true,
        createdBy: { select: { name: true } },
        orderItems: {
          select: {
            organizationId: true,
            quantity: true,
            storeName: true,
            productName: true,
            variantDescription: true,
            totalPriceGhs: true,
            discountGhs: true,
            taxGhs: true,
            installationUnitGhs: true,
          },
        },
      },
    })
    if (!order) return

    const stores = [...new Set(order.orderItems.map((item) => item.storeName))]
    const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
    const placedBy = source === "storefront" ? "A customer placed an order on the storefront." : `${order.createdBy?.name ?? "Staff"} created an order in ${stores.join(", ")}.`
    const fulfilment = order.shippingMethod === "DELIVERY" ? "Delivery" : "Pickup"

    // Each store hears about its own lines only, as its orders list shows them
    for (const storeId of new Set(order.orderItems.map((item) => item.organizationId))) {
      const lines = order.orderItems.filter((item) => item.organizationId === storeId)
      const shared = lines.length < order.orderItems.length
      const storeName = lines[0]!.storeName
      await toStoreTeam(
        settings,
        storeId,
        "notifyOrders",
        NotificationKind.ORDER,
        {
          subject: `New order ${order.reference}`,
          preview: `${order.customerName} · ${lines.reduce((sum, item) => sum + item.quantity, 0)} items`,
          heading: "New order",
          intro: `${source === "storefront" ? `A customer placed an order on the storefront with ${storeName}'s items.` : `${order.createdBy?.name ?? "Staff"} created an order in ${storeName}.`}${shared ? " It has other stores' items too: only yours are listed here." : ""}`,
          details: [
            { label: "Reference", value: order.reference },
            { label: "Customer", value: order.customerName },
            ...lines.map((item) => ({ label: item.variantDescription ? `${item.productName} (${item.variantDescription})` : item.productName, value: `× ${item.quantity}` })),
            { label: shared ? "Your items' total" : "Total", value: ghs(shared ? sumLines(lines) : order.totalGhs) },
            { label: "Fulfilment", value: fulfilment },
          ],
        },
        { label: "View order", path: `/store/orders/${orderId}/details` },
        "store new order",
        order.createdById
      )
    }

    await toPlatform(
      settings,
      NotificationKind.ORDER,
      [source === "storefront" ? "STOREFRONT_ORDERS" : "STAFF_ORDERS"],
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
          { label: "Fulfilment", value: fulfilment },
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
      },
      { label: "View order", path: `/orders/${orderId}/details` },
      "new order",
      order.createdById
    )
  } catch (error) {
    console.error(`New order notification for ${orderId} failed:`, error)
  }
}

export interface StockAlert {
  kind: "low" | "out"
  storeId: string
  storeName: string
  // "Tee (Size: M)"
  label: string
  stock: number
  threshold: number
}

const stockHeading = (alerts: StockAlert[]) => (alerts.some((alert) => alert.kind === "out") ? "Out of stock" : "Low stock")
const stockSubject = (heading: string, alerts: StockAlert[]) => (alerts.length === 1 ? `${heading}: ${alerts[0]!.label}` : `${heading}: ${alerts.length} items`)
const stockLevel = (alert: StockAlert) => (alert.kind === "out" ? "out of stock" : `${alert.stock} left (alert at ${alert.threshold})`)

// Items a sale took down to their low-stock threshold, or to 0: one notice for the lot, so an order selling several
// items sends one, not one per item. Each store's team hears of its own (both kinds under one switch).
export async function notifyStockAlerts(alerts: StockAlert[]) {
  try {
    if (alerts.length === 0) return
    const settings = await readAppSettings()

    for (const storeId of new Set(alerts.map((alert) => alert.storeId))) {
      const own = alerts.filter((alert) => alert.storeId === storeId)
      const heading = stockHeading(own)
      await toStoreTeam(
        settings,
        storeId,
        "notifyStock",
        NotificationKind.STOCK,
        {
          subject: stockSubject(heading, own),
          preview: own.map((alert) => alert.label).join(", "),
          heading,
          intro: `A sale left ${own.length === 1 ? "this item" : "these items"} in ${own[0]!.storeName} needing restocking.`,
          details: own.map((alert) => ({ label: alert.label, value: stockLevel(alert) })),
        },
        { label: "View listings", path: `/store/listings?stock=${heading === "Out of stock" ? "out" : "low"}` },
        "store stock"
      )
    }

    await toPlatform(
      settings,
      NotificationKind.STOCK,
      ["LOW_STOCK", "OUT_OF_STOCK"],
      // Each reader hears of the kinds they want
      (wants) => {
        const wanted = alerts.filter((alert) => wants(alert.kind === "out" ? "OUT_OF_STOCK" : "LOW_STOCK"))
        if (wanted.length === 0) return null
        const heading = stockHeading(wanted)
        return {
          subject: stockSubject(heading, wanted),
          preview: wanted.map((alert) => alert.label).join(", "),
          heading,
          intro: `A sale left ${wanted.length === 1 ? "this item" : "these items"} needing restocking.`,
          details: wanted.map((alert) => ({
            label: `${alert.label} (${alert.storeName})`,
            value: stockLevel(alert),
          })),
        }
      },
      // Stock is kept in each store's workspace, so there's no one page to open
      null,
      "stock"
    )
  } catch (error) {
    console.error("Stock notification failed:", error)
  }
}

export interface RefundNotice {
  amountGhs: string
  reason: string
  givenById: string
  kind: "refund" | "cancel" | "return"
}

// Money given back on an order, on its own, with a cancellation or with a return. storeId is the store whose own
// owner or admin gave it, which tells the platform (a superAdmin's refunds don't: null). An order made only of one
// store's items also tells that store's team, whoever gave it; an order shared between stores is the platform's.
// Never more than one per refund, so no batching.
export async function notifyRefund(orderId: string, storeId: string | null, refund: RefundNotice) {
  try {
    const settings = await readAppSettings()
    const [order, givenBy] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        select: { reference: true, customerName: true, totalGhs: true, orderItems: { select: { organizationId: true, storeName: true } } },
      }),
      prisma.user.findUnique({ where: { id: refund.givenById }, select: { name: true } }),
    ])
    if (!order) return

    const what = refund.kind === "cancel" ? "cancelled and refunded" : refund.kind === "return" ? "recorded a return and refunded" : "refunded"
    const details = [
      { label: "Reference", value: order.reference },
      { label: "Customer", value: order.customerName },
      { label: "Refunded", value: ghs(refund.amountGhs) },
      { label: "Order total", value: ghs(order.totalGhs) },
      { label: "Reason", value: refund.reason },
    ]

    const storeIds = new Set(order.orderItems.map((item) => item.organizationId))
    const [onlyStoreId] = storeIds
    if (storeIds.size === 1 && onlyStoreId) {
      await toStoreTeam(
        settings,
        onlyStoreId,
        "notifyRefunds",
        NotificationKind.REFUND,
        {
          subject: `${ghs(refund.amountGhs)} refunded on ${order.reference}`,
          preview: refund.reason,
          heading: "Refund given",
          intro: `${givenBy?.name ?? "Staff"} ${what} an order in ${order.orderItems[0]!.storeName}.`,
          details,
        },
        { label: "View order", path: `/store/orders/${orderId}/details` },
        "store team refund",
        refund.givenById
      )
    }

    if (!storeId) return
    const store = await prisma.organization.findUnique({ where: { id: storeId }, select: { name: true } })
    await toPlatform(
      settings,
      NotificationKind.REFUND,
      ["STORE_REFUNDS"],
      {
        subject: `${store?.name ?? "A store"} refunded ${ghs(refund.amountGhs)} on ${order.reference}`,
        preview: refund.reason,
        heading: "Refund given by a store",
        intro: `${givenBy?.name ?? "Staff"} ${what} an order in ${store?.name ?? "a store"}.`,
        details,
      },
      { label: "View order", path: `/orders/${orderId}/details` },
      "store refund"
    )
  } catch (error) {
    console.error(`Refund notification for ${orderId} failed:`, error)
  }
}

// A customer posted a 1 or 2 star review (an edit down to one counts too), so staff can look into what went wrong,
// or hide it if it breaks the rules
export async function notifyLowRating(reviewId: string) {
  try {
    const settings = await readAppSettings()

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { rating: true, title: true, body: true, variantLabel: true, productId: true, product: { select: { name: true } }, user: { select: { name: true, email: true } } },
    })
    if (!review) return

    await toPlatform(
      settings,
      NotificationKind.REVIEW,
      ["LOW_RATINGS"],
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
      },
      { label: "View reviews", path: `/catalogue/reviews?product=${review.productId}` },
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

    const account = await prisma.tradeAccount.findUnique({
      where: { id: accountId },
      select: { companyName: true, registrationNumber: true, tin: true, phone: true, businessType: true, details: true, user: { select: { name: true, email: true } } },
    })
    if (!account) return

    await toPlatform(
      settings,
      NotificationKind.TRADE_ACCOUNT,
      ["TRADE_APPLICATIONS"],
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
      },
      { label: "Review the application", path: `/trade-accounts/${accountId}` },
      "trade application"
    )
  } catch (error) {
    console.error(`Trade application notification for ${accountId} failed:`, error)
  }
}

// A customer made a quotation on the storefront, for staff who follow them up (off by default: they may be common)
export async function notifyNewQuote(quoteId: string) {
  try {
    const settings = await readAppSettings()

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        reference: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        tradeCompanyName: true,
        totalGhs: true,
        validUntil: true,
        shippingTown: true,
        _count: { select: { items: true } },
      },
    })
    if (!quote) return

    await toPlatform(
      settings,
      NotificationKind.QUOTE,
      ["QUOTES"],
      {
        subject: `New quotation ${quote.reference}`,
        preview: `${quote.tradeCompanyName ?? quote.customerName} · ${ghs(quote.totalGhs)}`,
        heading: "New quotation",
        intro: `${quote.tradeCompanyName ?? quote.customerName} made a quotation on the storefront. It isn't an order until they accept it.`,
        details: [
          { label: "Reference", value: quote.reference },
          { label: "Customer", value: `${quote.customerName}, ${quote.customerEmail}, ${quote.customerPhone}` },
          ...(quote.tradeCompanyName ? [{ label: "Trade account", value: quote.tradeCompanyName }] : []),
          { label: "Lines", value: String(quote._count.items) },
          { label: "Total", value: ghs(quote.totalGhs) },
          { label: "Deliver to", value: quote.shippingTown },
          // The last day its prices hold: validUntil is the start of the day after
          { label: "Valid until", value: formatDate(new Date(quote.validUntil.getTime() - 1), "MMM d, yyyy") },
        ],
      },
      { label: "View quotations", path: `/quotes?search=${quote.reference}` },
      "new quote"
    )
  } catch (error) {
    console.error(`New quote notification for ${quoteId} failed:`, error)
  }
}

// The daily exchange-rate fetch failed. The last rate stays usable for a while, then orders stop until one is set.
export async function notifyRateFetchFailed(date: string, error: string) {
  try {
    const settings = await readAppSettings()

    const day = formatDate(`${date}T12:00:00Z`, "MMM d, yyyy")
    await toPlatform(
      settings,
      NotificationKind.EXCHANGE_RATE,
      ["RATE_FETCH_FAILURE"],
      {
        subject: `Exchange rate for ${day} wasn't fetched`,
        preview: error,
        heading: "Exchange rate not fetched",
        intro: `Today's USD→GHS rate couldn't be fetched automatically. Orders use the last rate until it's too old, so set today's in Settings.`,
        details: [
          { label: "Day", value: day },
          { label: "Reason", value: error },
        ],
      },
      { label: "Open Settings", path: "/settings" },
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
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { reference: true, customerName: true, totalGhs: true } })
    if (!order) return

    // Logged as well, in case no one is listening
    console.error(`Payment problem (${problem}) on order ${orderId}, Paystack reference ${paystackReference}`)
    const { heading, intro } = PAYMENT_PROBLEMS[problem]
    await toPlatform(
      settings,
      NotificationKind.PAYMENT_PROBLEM,
      [],
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
      },
      { label: "View order", path: `/orders/${orderId}/details` },
      "payment problem"
    )
  } catch (error) {
    console.error(`Payment problem notification for ${orderId} failed:`, error)
  }
}
