import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import z from "zod"
import { organizationRoles } from "@workspace/auth/organization-permissions"
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
  TotalRow,
} from "@/components/orders/order-details"
import { EditOrderCustomer, EditOrderDelivery, EditOrderNotes } from "@/components/orders/order-edits"
import InstallationCard from "@/components/orders/installation-card"
import { InvoiceButton } from "@/components/orders/invoice-button"
import RecordPayment from "@/components/orders/record-payment"
import OrderRefunds from "@/components/orders/refund-order"
import RecordReturn from "@/components/orders/return-order"
import UpdateOrderStatus from "@/components/orders/update-order-status"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreOrderDetails } from "@/lib/data/store-orders.data"
import { canBeReturned, isPaid, nextOrderStatuses, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, returnBlockedReason } from "@workspace/commerce/order-status"

export const metadata: Metadata = {
  title: "Order Details",
}

type OrderDetailsPageProps = {
  params: Promise<{ id: string }>
}

export default async function StoreOrderDetailsPage({ params }: OrderDetailsPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  if (!organizationRoles[role].authorize({ order: ["read"] }).success) redirect("/forbidden")

  const { id } = await params
  // Order.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getStoreOrderDetails(storeId, id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  const order = response.data
  const { totals, afterSale } = order
  // A pending order of the store's own items can still be corrected; the dialogs check the role themselves
  const isEditable = order.status === OrderStatus.PENDING && !order.isMultiStore
  const canBePaid = (order.paymentStatus === PaymentStatus.PENDING || order.paymentStatus === PaymentStatus.FAILED) && order.status !== OrderStatus.CANCELLED
  const returned = returnState(order.lines)
  const returnBlocked = afterSale && returnBlockedReason(order, afterSale.returnableLines.length)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-mono text-xl font-bold md:text-2xl">{order.reference}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{`Placed ${formatDate(order.createdAt, "MMM d, yyyy, h:mm a")}${order.createdBy ? ` by ${order.createdBy}` : ""}`}</span>
            {order.quote && (
              <a href={order.quote.url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline hover:underline-offset-4">
                {`From quotation ${order.quote.reference}`}
              </a>
            )}
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            {returned && <Badge variant="secondary">{returned}</Badge>}
            {order.isMultiStore && <Badge variant="outline">With other stores</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* The invoice shows the whole order, so only for one made of the store's own items */}
          <BackButton link="/store/orders" />
          {!order.isMultiStore && <InvoiceButton reference={order.reference} orderId={order.id} />}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="grid auto-rows-max gap-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>{order.isMultiStore ? "This store's items only. The platform manages this order." : "In GHS, at the order's exchange rate."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <OrderLinesTable lines={order.lines} />
              <Separator />
              {totals ? (
                <OrderTotalsSummary totals={totals} exchangeRate={order.exchangeRate} />
              ) : (
                <div className="ml-auto grid w-full max-w-xs gap-1.5">
                  {/* Shipping and the order total cover other stores' items too */}
                  <TotalRow label="This store's items" amount={ghs(order.storeTotalGhs)} strong />
                  <p className="text-right text-xs text-muted-foreground">After their share of any discount, with tax</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* The store's own orders only: the platform handles refunds and returns on an order shared with other stores */}
          {afterSale && (canBeReturned(order.status) || afterSale.returns.length > 0) && (
            <OrderReturnsCard
              returns={afterSale.returns}
              actions={
                returnBlocked ? (
                  <p className="text-sm text-muted-foreground">{returnBlocked}</p>
                ) : (
                  <RecordReturn
                    storeId={storeId}
                    orderId={order.id}
                    refundedGhs={afterSale.refundedGhs}
                    returnCount={afterSale.returns.length}
                    refundableGhs={afterSale.refundableGhs}
                    canRefund={isPaid(order.paymentStatus)}
                    paymentMethod={order.paymentMethod}
                    lines={afterSale.returnableLines}
                    showStore={false}
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
                storeId={storeId}
                order={{ id: order.id, status: order.status, paymentStatus: order.paymentStatus, shippingMethod: order.shippingMethod }}
                isMultiStore={order.isMultiStore}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
              <CardDescription>Payments and refunds.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Status">
                  <PaymentStatusBadge status={order.paymentStatus} />
                </Detail>
                <Detail label="Method">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</Detail>
                {order.paidAt && <Detail label="Paid on">{formatDate(order.paidAt, "MMM d, yyyy, h:mm a")}</Detail>}
                {afterSale && Number(afterSale.refundedGhs) > 0 && <Detail label="Refunded">{ghs(afterSale.refundedGhs)}</Detail>}
              </div>
              {canBePaid && <RecordPayment storeId={storeId} orderId={order.id} totalGhs={totals?.totalGhs ?? null} defaultMethod={order.paymentMethod} />}
              {/* Money the order still holds can go back; the buttons check the role themselves */}
              {afterSale && isPaid(order.paymentStatus) && (
                <OrderRefunds
                  storeId={storeId}
                  orderId={order.id}
                  refundedGhs={afterSale.refundedGhs}
                  refundableGhs={afterSale.refundableGhs}
                  paymentMethod={order.paymentMethod}
                  status={order.status}
                  canCancel={nextOrderStatuses(order.status, order.shippingMethod).includes(OrderStatus.CANCELLED)}
                />
              )}
              {order.isMultiStore && <p className="text-sm text-muted-foreground">The platform handles refunds and returns on orders shared with other stores.</p>}
            </CardContent>
          </Card>

          {order.installation && (
            <InstallationCard
              storeId={storeId}
              orderId={order.id}
              installation={order.installation}
              order={order}
              refundedGhs={afterSale?.refundedGhs ?? null}
              refundableGhs={afterSale?.refundableGhs ?? null}
            />
          )}

          <OrderCustomerCard
            customer={order.customer}
            shipping={order.shipping}
            trade={order.trade}
            actions={
              isEditable && (
                <>
                  <EditOrderCustomer storeId={storeId} orderId={order.id} customer={order.customer} />
                  {order.shipping && <EditOrderDelivery storeId={storeId} orderId={order.id} shipping={order.shipping} />}
                </>
              )
            }
          />

          <OrderNotesCard notes={order.notes} actions={isEditable && <EditOrderNotes storeId={storeId} orderId={order.id} notes={order.notes} />} />
        </div>
      </div>
    </div>
  )
}
