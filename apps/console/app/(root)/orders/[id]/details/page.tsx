import type { Metadata } from "next"
import { Fragment } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import z from "zod"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { formatDate } from "@workspace/utils/date"
import BackButton from "@/components/back-button"
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-badges"
import {
  Detail,
  ghs,
  OrderCustomerCard,
  OrderLinesTable,
  OrderNotesCard,
  OrderPaymentAttemptsCard,
  OrderReturnsCard,
  OrderTimelineCard,
  OrderTotalsSummary,
  returnState,
} from "@/components/orders/order-details"
import { EditOrderCustomer, EditOrderDelivery, EditOrderNotes } from "@/components/orders/order-edits"
import InstallationCard from "@/components/orders/installation-card"
import { InvoiceButton } from "@/components/orders/invoice-button"
import RecordPayment from "@/components/orders/record-payment"
import OrderRefunds from "@/components/orders/refund-order"
import RecordReturn from "@/components/orders/return-order"
import UpdateOrderStatus from "@/components/orders/update-order-status"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getOrderDetails } from "@/lib/data/orders.data"
import { canBeReturned, isPaid, nextOrderStatuses, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, returnBlockedReason } from "@workspace/commerce/order-status"

export const metadata: Metadata = {
  title: "Order Details",
}

type OrderDetailsPageProps = {
  params: Promise<{ id: string }>
}

// The platform's view of any order: every store's lines, with the status, payment and edit controls stores have
export default async function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  await requireSystemPermission({ order: ["read"] })

  const { id } = await params
  // Order.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getOrderDetails(id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  const order = response.data
  // The controls check the viewer's permission themselves
  const isEditable = order.status === OrderStatus.PENDING
  const canBePaid = (order.paymentStatus === PaymentStatus.PENDING || order.paymentStatus === PaymentStatus.FAILED) && order.status !== OrderStatus.CANCELLED
  const hasRefunds = Number(order.refundedGhs) > 0
  const returned = returnState(order.lines)
  const returnBlocked = returnBlockedReason(order, order.returnableLines.length)

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-mono text-xl font-bold md:text-2xl">{order.reference}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{`Placed ${formatDate(order.createdAt, "MMM d, yyyy, h:mm a")}${order.createdBy ? ` by ${order.createdBy}` : ""}`}</span>
            {order.quote && (
              <Link href={`/quotes/${order.quote.id}`} className="hover:text-foreground hover:underline hover:underline-offset-4">
                {`From quotation ${order.quote.reference}`}
              </Link>
            )}
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            {returned && <Badge variant="secondary">{returned}</Badge>}
            {order.isMultiStore && <Badge variant="outline">{`${order.stores.length} stores`}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceButton reference={order.reference} orderId={order.id} />
          <BackButton link="/orders" />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="grid auto-rows-max gap-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                {"From "}
                {order.stores.map((store, index) => (
                  <Fragment key={store.id}>
                    {index > 0 && ", "}
                    <Link href={`/stores/${store.id}/edit`} className="underline-offset-4 hover:text-foreground hover:underline">
                      {store.name}
                    </Link>
                  </Fragment>
                ))}
                {". In GHS, at the order's exchange rate."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <OrderLinesTable lines={order.lines} showStore={order.isMultiStore} />
              <Separator />
              <OrderTotalsSummary totals={order.totals} exchangeRate={order.exchangeRate} />
            </CardContent>
          </Card>

          {/* Once the customer has the order, or when something already came back */}
          {(canBeReturned(order.status) || order.returns.length > 0) && (
            <OrderReturnsCard
              returns={order.returns}
              actions={
                returnBlocked ? (
                  <p className="text-sm text-muted-foreground">{returnBlocked}</p>
                ) : (
                  <RecordReturn
                    storeId={null}
                    orderId={order.id}
                    refundedGhs={order.refundedGhs}
                    returnCount={order.returns.length}
                    refundableGhs={order.refundableGhs}
                    canRefund={isPaid(order.paymentStatus)}
                    paymentMethod={order.paymentMethod}
                    lines={order.returnableLines}
                    showStore={order.isMultiStore}
                  />
                )
              }
            />
          )}

          {order.paymentAttempts.length > 0 && <OrderPaymentAttemptsCard attempts={order.paymentAttempts} />}

          <OrderTimelineCard timeline={order.timeline} />
        </div>

        {/* Right column */}
        <div className="grid auto-rows-max gap-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>{`Currently ${ORDER_STATUS_LABELS[order.status].toLowerCase()}.`}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Keyed by status, so the form starts afresh with the new next steps after a change */}
              <UpdateOrderStatus
                key={order.status}
                storeId={null}
                order={{ id: order.id, status: order.status, paymentStatus: order.paymentStatus, shippingMethod: order.shippingMethod }}
                isMultiStore={order.isMultiStore}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
              <CardDescription>The record of money for this order; its status above tracks fulfilment.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Status">
                  <PaymentStatusBadge status={order.paymentStatus} />
                </Detail>
                <Detail label="Method">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</Detail>
                {order.paidAt && <Detail label="Paid on">{formatDate(order.paidAt, "MMM d, yyyy, h:mm a")}</Detail>}
                {hasRefunds && <Detail label="Refunded">{ghs(order.refundedGhs)}</Detail>}
              </div>
              {canBePaid && <RecordPayment storeId={null} orderId={order.id} totalGhs={order.totals.totalGhs} defaultMethod={order.paymentMethod} />}
              {/* Money the order still holds can go back; the buttons check the permission themselves */}
              {isPaid(order.paymentStatus) && (
                <OrderRefunds
                  storeId={null}
                  orderId={order.id}
                  refundedGhs={order.refundedGhs}
                  refundableGhs={order.refundableGhs}
                  paymentMethod={order.paymentMethod}
                  status={order.status}
                  canCancel={nextOrderStatuses(order.status, order.shippingMethod).includes(OrderStatus.CANCELLED)}
                />
              )}
            </CardContent>
          </Card>

          {order.installation && (
            <InstallationCard storeId={null} orderId={order.id} installation={order.installation} order={order} refundedGhs={order.refundedGhs} refundableGhs={order.refundableGhs} />
          )}

          <OrderCustomerCard
            customer={order.customer}
            shipping={order.shipping}
            trade={order.trade}
            tradeHref={order.trade?.accountId ? `/trade-accounts/${order.trade.accountId}` : null}
            actions={
              isEditable && (
                <>
                  <EditOrderCustomer storeId={null} orderId={order.id} customer={order.customer} />
                  {order.shipping && <EditOrderDelivery storeId={null} orderId={order.id} shipping={order.shipping} />}
                </>
              )
            }
          />

          <OrderNotesCard notes={order.notes} actions={isEditable && <EditOrderNotes storeId={null} orderId={order.id} notes={order.notes} />} />
        </div>
      </div>
    </main>
  )
}
