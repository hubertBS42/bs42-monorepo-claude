import { getStoreDashboard } from "@/lib/data/dashboard.data"
import { getRecentStoreOrderDetails } from "@/lib/data/store-orders.data"
import type { DashboardPeriod } from "@/types"
import AttentionCard from "./attention-card"
import { toOrderSummary } from "./order-summary"
import RecentOrders from "./recent-orders"
import SalesChart from "./sales-chart"
import SectionCards from "./section-cards"
import TopSellers from "./top-sellers"

// The orders the table lists and the card browses
const RECENT_ORDERS = 10

export default async function StoreDashboard({ storeId, period }: { storeId: string; period: DashboardPeriod }) {
  const [dashboard, recent] = await Promise.all([getStoreDashboard(storeId, period), getRecentStoreOrderDetails(storeId, RECENT_ORDERS)])
  if (!dashboard.success) throw new Error(dashboard.error)
  if (!recent.success) throw new Error(recent.error)
  const { orders, lowStock, outOfStock, overduePurchaseOrders, sales, topSellers } = dashboard.data

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <SectionCards sales={sales} period={period} />
      <div className="grid gap-4 md:gap-6 @5xl/main:grid-cols-[2fr_1fr]">
        <SalesChart days={sales.days} period={period} />
        <AttentionCard
          items={[
            { label: "Waiting to be confirmed", hint: "Pending orders", count: orders.pending, href: "/store/orders?status=PENDING" },
            { label: "To prepare", hint: "Confirmed orders", count: orders.confirmed, href: "/store/orders?status=CONFIRMED" },
            { label: "To ship or hand over", hint: "Orders being processed", count: orders.processing, href: "/store/orders?status=PROCESSING" },
            { label: "Delivered, not paid", hint: "No payment recorded yet", count: orders.unpaidDelivered, href: "/store/orders?status=DELIVERED&paymentStatus=PENDING", urgent: true },
            { label: "Out of stock", hint: "Listings that can't be sold", count: outOfStock, href: "/store/listings?stock=out", urgent: true },
            { label: "Low on stock", hint: "At or under their low-stock threshold", count: lowStock, href: "/store/listings?stock=low" },
            { label: "Purchase orders overdue", hint: "Their expected delivery day has passed", count: overduePurchaseOrders, href: "/store/purchase-orders?overdue=true" },
          ]}
        />
      </div>
      <TopSellers sellers={topSellers} period={period} description="This store's listings" />
      <RecentOrders
        listHref="/store/orders"
        description="The latest orders with this store's items."
        orders={recent.data.map((order) =>
          toOrderSummary(order, {
            href: `/store/orders/${order.id}/details`,
            totalGhs: order.totals?.totalGhs ?? order.storeTotalGhs,
            note: order.isMultiStore ? "With other stores' items" : undefined,
          })
        )}
      />
    </div>
  )
}
