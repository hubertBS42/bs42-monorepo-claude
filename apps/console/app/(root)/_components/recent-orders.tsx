import Link from "next/link"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { buttonVariants } from "@workspace/ui/components/button"
import { formatDate } from "@workspace/utils/date"
import type { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-badges"
import { ghs } from "@/components/orders/order-details"

export interface RecentOrder {
  id: string
  reference: string
  customerName: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  totalGhs: string
  createdAt: Date
  // The stores' names on the platform's dashboard, or a note on the store's
  note?: string
}

export default function RecentOrders({ orders, listHref, description }: { orders: RecentOrder[]; listHref: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent orders</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Link href={listHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="grid divide-y">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`${listHref}/${order.id}/details`}
                  className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2.5 hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate text-sm font-medium">{order.customerName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{order.reference}</span> · {formatDate(order.createdAt, "LLL dd, HH:mm")}
                      {order.note && ` · ${order.note}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={order.paymentStatus} />
                    <span className="w-24 text-right text-sm tabular-nums">{ghs(order.totalGhs)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
