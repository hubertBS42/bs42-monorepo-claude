import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CircleCheck, CircleX, Clock, Package } from "lucide-react"
import { canStartPayment, paymentDeadline } from "@workspace/commerce/online-payments"
import { hasBeenPaid, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { prisma } from "@workspace/db"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { formatDate } from "@workspace/utils/date"
import { getStringParam } from "@workspace/utils/search-params"

import { PayNowButton, ReorderButton } from "@/components/orders/order-actions"
import type { SearchParams } from "@/lib/catalogue-filters"
import { formatGhs } from "@/lib/money"
import { isOrderKey } from "@/lib/order-access"

export const metadata: Metadata = { title: "Your order", robots: { index: false } }

interface OrderPageProps {
  params: Promise<{ reference: string }>
  // ?key= opens the order (lib/order-access.ts); ?payment=unavailable after Paystack couldn't be reached
  searchParams: Promise<SearchParams>
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export default async function OrderPage({ params, searchParams }: OrderPageProps) {
  const [{ reference }, query] = await Promise.all([params, searchParams])
  const key = getStringParam(query.key)

  const order = await prisma.order.findUnique({
    where: { reference },
    select: {
      id: true,
      reference: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      createdById: true,
      createdAt: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      shippingLine1: true,
      shippingLine2: true,
      shippingTown: true,
      shippingRegion: true,
      subtotalGhs: true,
      discountAmountGhs: true,
      shippingGhs: true,
      taxGhs: true,
      totalGhs: true,
      orderItems: { orderBy: { id: "asc" }, select: { id: true, productName: true, productImage: true, variantDescription: true, quantity: true, totalPriceGhs: true } },
    },
  })
  // The same answer for a wrong key as for no order, so references can't be probed
  if (!order || !key || !isOrderKey(order.id, key)) notFound()

  const paid = hasBeenPaid(order.paymentStatus)
  const cancelled = order.status === OrderStatus.CANCELLED
  // A paid order's heading follows its delivery
  const firstName = order.customerName.split(" ")[0]
  const paidHeading =
    order.status === OrderStatus.SHIPPED
      ? "Your order is on its way."
      : order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED
        ? "Your order has been delivered."
        : `Thank you, ${firstName}. Your order is placed.`
  const payable = canStartPayment(order)
  const deadline = formatDate(paymentDeadline(order.createdAt), "HH:mm")
  const address = [order.shippingLine1, order.shippingLine2, order.shippingTown, order.shippingRegion].filter(Boolean).join(", ")
  const discount = order.discountAmountGhs?.gt(0) ? order.discountAmountGhs : null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
      <div className="mb-8 flex flex-col gap-4">
        {cancelled ? (
          <>
            <CircleX className="size-10 text-muted-foreground" aria-hidden />
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">This order was cancelled</h1>
            <p className="text-muted-foreground">
              {paid
                ? order.paymentStatus === PaymentStatus.REFUNDED
                  ? "It was cancelled after your payment came in, and we've refunded you. If you have questions, contact us with your order reference."
                  : "It was cancelled after your payment came in. We'll refund you; if you have questions, contact us with your order reference."
                : "It wasn't paid for in time, so we released the items. You can put them back in your basket and order again."}
            </p>
            {!paid && (
              <div>
                <ReorderButton orderId={order.id} orderKey={key} />
              </div>
            )}
          </>
        ) : paid ? (
          <>
            <CircleCheck className="size-10 text-green-600" aria-hidden />
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{paidHeading}</h1>
            {order.status === OrderStatus.PENDING || order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.PROCESSING ? (
              <p className="text-muted-foreground">We've received your payment{order.customerEmail && <> and sent a confirmation to {order.customerEmail}</>}. We'll be in touch about delivery.</p>
            ) : (
              <p className="text-muted-foreground">Thank you for shopping with us, {firstName}.</p>
            )}
          </>
        ) : (
          <>
            <Clock className="size-10 text-amber-500" aria-hidden />
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Your order is waiting for payment</h1>
            {getStringParam(query.payment) === "unavailable" && <p className="font-medium text-destructive">We couldn't reach our payment provider just now. Please try again.</p>}
            {payable ? (
              <>
                <p className="text-muted-foreground">
                  We're holding your items until {deadline}. If you've just paid, it can take a minute to show here: refresh the page. Otherwise, pay now to complete your order.
                </p>
                <div>
                  <PayNowButton orderId={order.id} orderKey={key} label={`Pay ${formatGhs(order.totalGhs.toFixed(2))}`} />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">The time to pay has run out, so we're cancelling this order. If you paid, it will show here shortly.</p>
            )}
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Order {order.reference}</CardTitle>
            <Badge variant="secondary">{ORDER_STATUS_LABELS[order.status]}</Badge>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ul className="space-y-3">
              {order.orderItems.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {item.productImage ? (
                      // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
                      <img src={item.productImage} alt="" className="size-full object-contain p-1" />
                    ) : (
                      <Package className="size-5 text-muted-foreground/40" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-muted-foreground">
                      {item.variantDescription && `${item.variantDescription} · `}Qty {item.quantity}
                    </p>
                  </div>
                  <span className="tabular-nums">{formatGhs(item.totalPriceGhs.toFixed(2))}</span>
                </li>
              ))}
            </ul>
            <Separator />
            <div className="space-y-2">
              <Row label="Subtotal" value={formatGhs(order.subtotalGhs.toFixed(2))} />
              {discount && <Row label="Discount" value={`−${formatGhs(discount.toFixed(2))}`} />}
              <Row label="Delivery" value={order.shippingGhs.isZero() ? "Free" : formatGhs(order.shippingGhs.toFixed(2))} />
              {order.taxGhs.gt(0) && <Row label="Tax" value={formatGhs(order.taxGhs.toFixed(2))} />}
            </div>
            <Separator />
            <Row label="Total" value={formatGhs(order.totalGhs.toFixed(2))} strong />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{order.customerName}</p>
              <p className="text-muted-foreground">{address}</p>
              {order.customerPhone && <p className="text-muted-foreground">{order.customerPhone}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>{paid ? `Paid by ${PAYMENT_METHOD_LABELS[order.paymentMethod].toLowerCase()}` : "Not paid yet"}</p>
              <p className="text-muted-foreground">Placed {formatDate(order.createdAt, "d MMM yyyy, HH:mm")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
