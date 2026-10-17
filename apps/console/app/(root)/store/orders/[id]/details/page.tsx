/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import z from "zod"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { OrderStatus, PaymentStatus } from "@workspace/db/enums"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import BackButton from "@/components/back-button"
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-badges"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreOrderDetails } from "@/lib/data/store-orders.data"
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/order-status"
import RecordPayment from "./_components/record-payment"
import UpdateOrderStatus from "./_components/update-order-status"

export const metadata: Metadata = {
  title: "Order Details",
}

type OrderDetailsPageProps = {
  params: Promise<{ id: string }>
}

const ghs = (amount: string) => formatCurrency(amount, "GHS", "en-GH")

// A label and value pair, as on the other details pages
const Detail = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="text-sm font-medium">{children}</div>
  </div>
)

const TotalRow = ({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) => (
  <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-sm"}>
    <span className={strong ? undefined : "text-muted-foreground"}>{label}</span>
    <span>{amount}</span>
  </div>
)

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="size-10 shrink-0 overflow-hidden rounded bg-muted">{line.productImage && <img alt="" src={line.productImage} className="size-full object-cover" />}</div>
                          <div className="grid gap-0.5">
                            <span>{line.productName}</span>
                            {line.variantDescription && <span className="text-xs text-muted-foreground">{line.variantDescription}</span>}
                            {line.sku && <span className="font-mono text-[11px] text-muted-foreground">{line.sku}</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">{ghs(line.unitPriceGhs)}</TableCell>
                      <TableCell className="text-right">{ghs(line.totalPriceGhs)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator />

              {totals ? (
                <div className="ml-auto grid w-full max-w-xs gap-1.5">
                  <TotalRow label="Subtotal" amount={ghs(totals.subtotalGhs)} />
                  {/* A zero discount isn't one */}
                  {totals.discountAmountGhs && Number(totals.discountAmountGhs) > 0 && (
                    <TotalRow
                      label={`Discount${totals.discountType === "PERCENTAGE" && totals.discountValue ? ` (${Number(totals.discountValue)}%)` : ""}`}
                      amount={`−${ghs(totals.discountAmountGhs)}`}
                    />
                  )}
                  {totals.discountReason && <p className="text-right text-xs text-muted-foreground">{totals.discountReason}</p>}
                  <TotalRow label="Shipping" amount={ghs(totals.shippingGhs)} />
                  <TotalRow label={`Tax${Number(totals.taxRate) ? ` (${(Number(totals.taxRate) * 100).toFixed(2).replace(/\.?0+$/, "")}%)` : ""}`} amount={ghs(totals.taxGhs)} />
                  <Separator className="my-1" />
                  <TotalRow label="Total" amount={ghs(totals.totalGhs)} strong />
                  <p className="text-right text-xs text-muted-foreground">{`At GH₵${Number(order.exchangeRate)} per $1`}</p>
                </div>
              ) : (
                <div className="ml-auto grid w-full max-w-xs gap-1.5">
                  {/* Shipping and the order total cover other stores' items too */}
                  <TotalRow label="This store's items" amount={ghs(order.storeTotalGhs)} strong />
                  <p className="text-right text-xs text-muted-foreground">After their share of any discount, with tax</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Every status change, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {order.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No status changes yet.</p>
              ) : (
                <ol className="grid gap-4">
                  {order.timeline.map((entry) => (
                    <li key={entry.id} className="grid gap-0.5 border-l-2 pl-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{entry.title}</span>
                        <span className="text-xs text-muted-foreground">{`${formatDate(entry.createdAt, "MMM d, yyyy, h:mm a")}${entry.changedBy ? ` · ${entry.changedBy}` : ""}`}</span>
                      </div>
                      {entry.note && <p className="text-sm text-muted-foreground">{entry.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
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

          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>{`${order.customer.isRegistered ? "Has an account" : "Walk-in, without an account"} · ${order.shipping ? "Delivery" : "Pickup"}`}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Detail label="Name">{order.customer.name}</Detail>
              <Detail label="Email">{order.customer.email ?? <span className="text-muted-foreground">Not given</span>}</Detail>
              <Detail label="Phone">{order.customer.phone ?? <span className="text-muted-foreground">Not given</span>}</Detail>
              <Separator />
              {order.shipping ? (
                <>
                  <Detail label="Deliver to">{[order.shipping.name, order.shipping.phone].filter(Boolean).join(" · ") || "—"}</Detail>
                  <Detail label="Address">{[order.shipping.line1, order.shipping.line2, order.shipping.town, order.shipping.region].filter(Boolean).join(", ") || "—"}</Detail>
                </>
              ) : (
                <Detail label="Pickup">The customer collects the order from the store.</Detail>
              )}
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
