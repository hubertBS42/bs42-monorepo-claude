import type { Metadata } from "next"
import Link from "next/link"
import { FileText, Package, PackageSearch } from "lucide-react"
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
import { EmptyState } from "@workspace/ui/components/empty-state"

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
        <CardContent>
          <EmptyState
            icon={Package}
            title="No orders yet"
            description={
              <>
                Orders you place signed in, or as a guest with {session.user.email}, show here.
                {!session.user.emailVerified && " Guest orders show once your email is confirmed."}
              </>
            }
          >
            <Button render={<Link href="/" />}>Start shopping</Button>
          </EmptyState>
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
              {/* The reference's link covers the card, so the whole card opens the order; the invoice's sits above it */}
              <Card className="relative bg-transparent transition-colors has-[a[data-order-link]:focus-visible]:ring-2 has-[a[data-order-link]:focus-visible]:ring-ring has-[a[data-order-link]:hover]:bg-muted/50">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={order.href} data-order-link className="font-medium outline-none after:absolute after:inset-0 after:rounded-xl">
                        {order.reference}
                      </Link>
                      <Badge variant={order.status === OrderStatus.CANCELLED ? "outline" : "secondary"}>{statusLabel(order.status, order.paymentStatus)}</Badge>
                      {refunded && <Badge variant="outline">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(order.createdAt, "d MMM yyyy")} · {order.itemCount === 1 ? "1 item" : `${order.itemCount} items`} · {formatGhs(order.totalGhs)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-2">
                    <div className="flex gap-2" aria-hidden>
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
                    <Button render={<Link href={order.invoiceHref} aria-label={`Invoice for ${order.reference}`} />} variant="outline" size="sm" className="relative z-10">
                      <FileText aria-hidden />
                      Invoice
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
