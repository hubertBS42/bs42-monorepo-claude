import { getStoreDashboard } from "@/lib/data/dashboard.data"
import { getStoreOrders } from "@/lib/data/store-orders.data"
import type { DashboardPeriod } from "@/types"
import AttentionCard from "./attention-card"
import RecentOrders from "./recent-orders"
import SalesCards from "./sales-cards"

export default async function StoreDashboard({ storeId, period }: { storeId: string; period: DashboardPeriod }) {
  const [dashboard, recent] = await Promise.all([getStoreDashboard(storeId, period), getStoreOrders(storeId, { pageSize: 5 })])
  if (!dashboard.success) throw new Error(dashboard.error)
  if (!recent.success) throw new Error(recent.error)
  const { orders, lowStock, outOfStock, sales } = dashboard.data

  return (
    <div className="grid gap-4">
      <SalesCards sales={sales} />
      <div className="grid items-start gap-4 @4xl/main:grid-cols-[2fr_3fr]">
        <AttentionCard
          items={[
            { label: "Waiting to be confirmed", hint: "Pending orders", count: orders.pending, href: "/store/orders?status=PENDING" },
            { label: "To prepare", hint: "Confirmed orders", count: orders.confirmed, href: "/store/orders?status=CONFIRMED" },
            { label: "To ship or hand over", hint: "Orders being processed", count: orders.processing, href: "/store/orders?status=PROCESSING" },
            { label: "Delivered, not paid", hint: "No payment recorded yet", count: orders.unpaidDelivered, href: "/store/orders?status=DELIVERED&paymentStatus=PENDING", urgent: true },
            { label: "Out of stock", hint: "Listings that can't be sold", count: outOfStock, href: "/store/listings?stock=out", urgent: true },
            { label: "Low on stock", hint: "At or under their low-stock threshold", count: lowStock, href: "/store/listings?stock=low" },
          ]}
        />
        <RecentOrders
          listHref="/store/orders"
          description="The latest orders with this store's items."
          orders={recent.data.data.map((order) => ({ ...order, note: order.isMultiStore ? "with other stores' items" : undefined }))}
        />
      </div>
    </div>
  )
}
