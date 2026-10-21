import type { Metadata } from "next"
import Link from "next/link"
import { Package, PackageSearch } from "lucide-react"
import { hasBeenPaid, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@workspace/commerce/order-status"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { formatDate } from "@workspace/utils/date"
import { getStringParam } from "@workspace/utils/search-params"

import type { SearchParams } from "@/lib/catalogue-filters"
import { getAccountOrders } from "@/lib/data/account-orders"
import { formatGhs } from "@/lib/money"
import { requireCustomer } from "@/lib/session"

export const metadata: Metadata = { title: "My orders", robots: { index: false } }

// What the customer sees of an order's state: an unpaid order waits for payment, whatever staff call it
function statusLabel(status: OrderStatus, paymentStatus: PaymentStatus) {
  if (status === OrderStatus.PENDING && !hasBeenPaid(paymentStatus)) return "Awaiting payment"
  return ORDER_STATUS_LABELS[status]
}

const pageHref = (page: number) => (page === 1 ? "/account/orders" : `/account/orders?page=${page}`)

export default async function AccountOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireCustomer("/account/orders")
  const query = await searchParams
  const { orders, total, page, pageCount } = await getAccountOrders(session.user, Number(getStringParam(query.page)) || 1)

  if (total === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Package className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No orders yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Orders you place signed in, or as a guest with {session.user.email}, show here.
            {!session.user.emailVerified && " Guest orders show once your email is confirmed."}
          </p>
          <Button render={<Link href="/" />} className="mt-2">
            Start shopping
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {total === 1 ? "1 order" : `${total} orders`}
        {session.user.emailVerified ? `, including any placed as a guest with ${session.user.email}.` : "."}
      </p>
      <ul className="flex flex-col gap-3">
        {orders.map((order) => {
          const refunded = order.paymentStatus === PaymentStatus.REFUNDED || order.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED
          return (
            <li key={order.id}>
              <Link href={order.href} className="block rounded-xl transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <Card className="bg-transparent">
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{order.reference}</span>
                        <Badge variant={order.status === OrderStatus.CANCELLED ? "outline" : "secondary"}>{statusLabel(order.status, order.paymentStatus)}</Badge>
                        {refunded && <Badge variant="outline">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(order.createdAt, "d MMM yyyy")} · {order.itemCount === 1 ? "1 item" : `${order.itemCount} items`} · {formatGhs(order.totalGhs)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2" aria-hidden>
                      {order.orderItems.map((item) => (
                        <div key={item.id} className="flex size-12 items-center justify-center overflow-hidden rounded-md border bg-muted" title={item.productName}>
                          {item.productImage ? (
                            // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
                            <img src={item.productImage} alt="" className="size-full object-contain p-1" />
                          ) : (
                            <Package className="size-4 text-muted-foreground/40" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          )
        })}
      </ul>

      {pageCount > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Button render={<Link href={pageHref(page - 1)} />} variant="outline" size="sm">
              Previous
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Button render={<Link href={pageHref(page + 1)} />} variant="outline" size="sm">
              Next
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </nav>
      )}

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <PackageSearch className="size-4" aria-hidden />
        Ordered with another email?{" "}
        <Link href="/orders/find" className="underline underline-offset-4 hover:text-foreground">
          Find an order
        </Link>
      </p>
    </div>
  )
}
