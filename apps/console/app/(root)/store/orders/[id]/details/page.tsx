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
import { Detail, ghs, OrderCustomerCard, OrderLinesTable, OrderNotesCard, OrderTimelineCard, OrderTotalsSummary, TotalRow } from "@/components/orders/order-details"
import { EditOrderCustomer, EditOrderDelivery, EditOrderNotes } from "@/components/orders/order-edits"
import RecordPayment from "@/components/orders/record-payment"
import UpdateOrderStatus from "@/components/orders/update-order-status"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreOrderDetails } from "@/lib/data/store-orders.data"
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/order-status"

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
  const { totals } = order
  // A pending order of the store's own items can still be corrected; the dialogs check the role themselves
  const isEditable = order.status === OrderStatus.PENDING && !order.isMultiStore
  const canBePaid = (order.paymentStatus === PaymentStatus.PENDING || order.paymentStatus === PaymentStatus.FAILED) && order.status !== OrderStatus.CANCELLED

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-mono text-xl font-bold md:text-2xl">{order.reference}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{`Placed ${formatDate(order.createdAt, "MMM d, yyyy, h:mm a")}${order.createdBy ? ` by ${order.createdBy}` : ""}`}</span>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            {order.isMultiStore && <Badge variant="outline">With other stores</Badge>}
          </div>
        </div>
        <BackButton link="/store/orders" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="grid auto-rows-max gap-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                {order.isMultiStore ? "This store's items. The order also has items from other stores, which the platform handles." : "In GHS, at the order's exchange rate."}
              </CardDescription>
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
              <CardDescription>The record of money for this order; its status above tracks fulfilment.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Status">
                  <PaymentStatusBadge status={order.paymentStatus} />
                </Detail>
                <Detail label="Method">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</Detail>
                {order.paidAt && <Detail label="Paid on">{formatDate(order.paidAt, "MMM d, yyyy, h:mm a")}</Detail>}
              </div>
              {canBePaid && <RecordPayment storeId={storeId} orderId={order.id} totalGhs={totals?.totalGhs ?? null} defaultMethod={order.paymentMethod} />}
            </CardContent>
          </Card>

          <OrderCustomerCard
            customer={order.customer}
            shipping={order.shipping}
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
    </main>
  )
}
