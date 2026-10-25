import { getAppSettings } from "@/lib/app-settings"
import { getPlatformDashboard } from "@/lib/data/dashboard.data"
import { getLatestExchangeRate } from "@workspace/commerce/exchange-rates"
import { getRecentOrderDetails } from "@/lib/data/orders.data"
import type { DashboardPeriod } from "@/types"
import AttentionCard from "./attention-card"
import ExchangeRateChart from "./exchange-rate-chart"
import { toOrderSummary } from "./order-summary"
import PlatformHealth from "./platform-health"
import RecentOrders from "./recent-orders"
import SalesChart from "./sales-chart"
import SectionCards from "./section-cards"
import TopSellers from "./top-sellers"

// The orders the table lists and the card browses
const RECENT_ORDERS = 10

// Stores listed by name under "Needs attention"; the rest are summed into one row
const STOCK_STORES_SHOWN = 5

// The mailer reads these when it sends (packages/email/src/mailer.ts)
const mailerConfigured = () => !!(process.env.SITE_MAILER_HOST?.trim() && process.env.SITE_MAILER_EMAIL?.trim() && process.env.SITE_MAILER_PASSWORD)

export default async function PlatformDashboard({ period, canOpenSettings }: { period: DashboardPeriod; canOpenSettings: boolean }) {
  const [dashboard, recent, rate, settings] = await Promise.all([getPlatformDashboard(period), getRecentOrderDetails(RECENT_ORDERS), getLatestExchangeRate(), getAppSettings()])
  if (!dashboard.success) throw new Error(dashboard.error)
  if (!recent.success) throw new Error(recent.error)
  const { orders, stockAlerts, overduePurchaseOrders, pendingProductRequests, sales, topSellers, exchangeRates } = dashboard.data

  const shown = stockAlerts.slice(0, STOCK_STORES_SHOWN)
  const others = stockAlerts.slice(STOCK_STORES_SHOWN)

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <SectionCards sales={sales} period={period} />
      <div className="grid gap-4 md:gap-6 @5xl/main:grid-cols-[2fr_1fr]">
        <SalesChart days={sales.days} period={period} />
        <AttentionCard
          items={[
            { label: "Waiting to be confirmed", hint: "Pending orders, from every store", count: orders.pending, href: "/orders?status=PENDING" },
            {
              label: "Shared orders to confirm",
              hint: "Pending, with more than one store's items: only the platform can confirm these",
              count: orders.multiStorePending,
              href: "/orders?status=PENDING&multiStore=true",
            },
            { label: "To prepare", hint: "Confirmed orders", count: orders.confirmed, href: "/orders?status=CONFIRMED" },
            { label: "To ship or hand over", hint: "Orders being processed", count: orders.processing, href: "/orders?status=PROCESSING" },
            { label: "Delivered, not paid", hint: "No payment recorded yet", count: orders.unpaidDelivered, href: "/orders?status=DELIVERED&paymentStatus=PENDING", urgent: true },
            // Listings are managed in each store's workspace, which ?workspace= switches to (proxy.ts)
            ...shown.map((store) => ({
              label: store.storeName,
              hint: [store.out && `${store.out} out of stock`, store.low && `${store.low} low on stock`].filter(Boolean).join(", "),
              count: store.out + store.low,
              href: `/store/listings?stock=${store.out ? "out" : "low"}&workspace=${store.storeId}`,
              switchesWorkspace: true,
              urgent: store.out > 0,
            })),
            ...(others.length
              ? [
                  {
                    label: `${others.length} more store${others.length === 1 ? "" : "s"}`,
                    hint: "With listings low on or out of stock",
                    count: others.reduce((sum, store) => sum + store.out + store.low, 0),
                  },
                ]
              : []),
            { label: "Purchase orders overdue", hint: "In every store: their expected delivery day has passed", count: overduePurchaseOrders, href: "/purchase-orders?overdue=true" },
            { label: "Product requests waiting", hint: "Products stores asked for that the catalogue doesn't have", count: pendingProductRequests, href: "/catalogue/product-requests?status=PENDING" },
          ]}
        />
      </div>
      <div className="grid gap-4 md:gap-6 @5xl/main:grid-cols-2">
        <TopSellers sellers={topSellers} period={period} description="Products from every store" />
        <ExchangeRateChart rates={exchangeRates} period={period} />
      </div>
      <PlatformHealth
        rate={rate}
        taxEnabled={settings.taxEnabled}
        mailerConfigured={mailerConfigured()}
        notificationRecipients={settings.notificationEmails.length}
        canOpenSettings={canOpenSettings}
      />
      <RecentOrders
        listHref="/orders"
        description="The latest orders from every store."
        orders={recent.data.map((order) => toOrderSummary(order, { href: `/orders/${order.id}/details`, totalGhs: order.totals.totalGhs, note: order.stores.map((store) => store.name).join(", ") }))}
      />
    </div>
  )
}
