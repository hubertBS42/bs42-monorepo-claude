import { getAppSettings } from "@/lib/app-settings"
import { getPlatformDashboard } from "@/lib/data/dashboard.data"
import { getLatestExchangeRate } from "@/lib/data/exchange-rates.data"
import { getOrders } from "@/lib/data/orders.data"
import type { DashboardPeriod } from "@/types"
import AttentionCard from "./attention-card"
import PlatformHealth from "./platform-health"
import RecentOrders from "./recent-orders"
import SalesCards from "./sales-cards"

// Stores listed by name under "Needs attention"; the rest are summed into one row
const STOCK_STORES_SHOWN = 5

// The mailer reads these when it sends (packages/email/src/mailer.ts)
const mailerConfigured = () => !!(process.env.SITE_MAILER_HOST?.trim() && process.env.SITE_MAILER_EMAIL?.trim() && process.env.SITE_MAILER_PASSWORD)

export default async function PlatformDashboard({ period, canOpenSettings }: { period: DashboardPeriod; canOpenSettings: boolean }) {
  const [dashboard, recent, rate, settings] = await Promise.all([getPlatformDashboard(period), getOrders({ pageSize: 5 }), getLatestExchangeRate(), getAppSettings()])
  if (!dashboard.success) throw new Error(dashboard.error)
  if (!recent.success) throw new Error(recent.error)
  const { orders, stockAlerts, sales } = dashboard.data

  const shown = stockAlerts.slice(0, STOCK_STORES_SHOWN)
  const others = stockAlerts.slice(STOCK_STORES_SHOWN)

  return (
    <div className="grid gap-4">
      <SalesCards sales={sales} />
      <div className="grid items-start gap-4 @4xl/main:grid-cols-[2fr_3fr]">
        <div className="grid gap-4">
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
              // Listings are managed in each store's workspace, so these have no link
              ...shown.map((store) => ({
                label: store.storeName,
                hint: [store.out && `${store.out} out of stock`, store.low && `${store.low} low on stock`].filter(Boolean).join(", "),
                count: store.out + store.low,
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
            ]}
          />
          <PlatformHealth
            rate={rate}
            taxEnabled={settings.taxEnabled}
            mailerConfigured={mailerConfigured()}
            notificationRecipients={settings.notificationEmails.length}
            canOpenSettings={canOpenSettings}
          />
        </div>
        <RecentOrders listHref="/orders" description="The latest orders from every store." orders={recent.data.data.map((order) => ({ ...order, note: order.storeNames.join(", ") }))} />
      </div>
    </div>
  )
}
