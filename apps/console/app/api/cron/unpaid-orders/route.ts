import { isCronAuthorized } from "@/lib/cron-auth"
import { cancelUnpaidOrders } from "@workspace/commerce/online-payments"
import { CART_LIFETIME_DAYS, NOTIFICATION_LIFETIME_DAYS } from "@workspace/contracts"
import { prisma } from "@workspace/db"

// Cancels storefront orders left unpaid (UNPAID_CANCEL_MINUTES after they were placed), which puts their stock back.
// Each order's open payments are checked with Paystack first, so one paid at the last moment is recorded, not
// cancelled; an order Paystack can't answer for is left for the next run. Also clears out storefront baskets nobody
// has added to in CART_LIFETIME_DAYS (their cookies have lapsed), and the bell's notifications older than
// NOTIFICATION_LIFETIME_DAYS. Meant for a scheduler every 5 minutes: POST with
// "Authorization: Bearer $CRON_SECRET".

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const orders = await cancelUnpaidOrders()
  const { count: cartsCleared } = await prisma.cart.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - CART_LIFETIME_DAYS * 24 * 60 * 60 * 1000) } } })
  const { count: notificationsCleared } = await prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - NOTIFICATION_LIFETIME_DAYS * 24 * 60 * 60 * 1000) } } })
  return Response.json({ ...orders, cartsCleared, notificationsCleared })
}
