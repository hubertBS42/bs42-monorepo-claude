import type { ReactNode } from "react"
import { Currency, PurchaseOrderStatus } from "@workspace/db/enums"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import BackButton from "@/components/back-button"
import { PurchaseOrderStatusBadge } from "@/components/order-badges"
import { Detail, TotalRow } from "@/components/orders/order-details"
import { formatCost, PURCHASE_ORDER_STATUS_LABELS } from "@/lib/purchase-order-status"
import type { PurchaseOrderDetails } from "@/types"

// A plain day (yyyy-MM-dd), read as noon UTC so no time zone moves it to another day
const formatDay = (day: string) => formatDate(new Date(`${day}T12:00:00Z`), "MMM d, yyyy")
const dateTime = (date: Date) => formatDate(date, "MMM d, yyyy, h:mm a")
const notGiven = <span className="text-muted-foreground">Not given</span>

const STATUS_DESCRIPTIONS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "A draft, not yet ordered.",
  ORDERED: "Ordered: items show as incoming until received.",
  PARTIALLY_RECEIVED: "Partly received: the rest shows as incoming.",
  RECEIVED: "Everything has been received.",
  CLOSED: "Closed before everything arrived.",
  CANCELLED: "Cancelled before anything arrived.",
}

interface TimelineEntry {
  id: string
  title: string
  createdAt: Date
  by: string | null
  notes: string[]
}

// Newest first, like an order's timeline
function toTimeline(order: PurchaseOrderDetails): TimelineEntry[] {
  const entries: TimelineEntry[] = [{ id: "created", title: "Created as a draft", createdAt: order.createdAt, by: order.createdBy, notes: [] }]
  if (order.orderedAt) entries.push({ id: "ordered", title: "Marked as ordered", createdAt: order.orderedAt, by: order.orderedBy, notes: [] })
  for (const receipt of order.receipts) {
    const count = receipt.items.reduce((sum, item) => sum + item.quantity, 0)
    entries.push({
      id: receipt.id,
      title: count === 1 ? "Received 1 item" : `Received ${count} items`,
      createdAt: receipt.createdAt,
      by: receipt.receivedBy,
      notes: [receipt.items.map((item) => `${item.quantity} × ${item.label}`).join(", "), ...(receipt.updatedBuyPrices ? ["Buy prices updated"] : []), ...(receipt.note ? [receipt.note] : [])],
    })
  }
  if (order.closedAt) {
    const title = order.status === PurchaseOrderStatus.CANCELLED ? "Cancelled" : "Closed"
    entries.push({ id: "closed", title, createdAt: order.closedAt, by: order.closedBy, notes: order.closeReason ? [order.closeReason] : [] })
  }
  return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

interface PurchaseOrderViewProps {
  order: PurchaseOrderDetails
  backTo: string
  // The Status card's content: the store's actions, or the platform's note that the store manages it
  statusContent: ReactNode
  // Names the store under the reference, on the platform's page
  showStore?: boolean
}

// A purchase order's page, in its store's workspace and in the platform's read-only view
export default function PurchaseOrderView({ order, backTo, statusContent, showStore = false }: PurchaseOrderViewProps) {
  const money = (amount: string) => formatCost(amount, order.currency)
  const isGhs = order.currency === Currency.GHS
  const timeline = toTimeline(order)
  const showsReceived = order.status !== PurchaseOrderStatus.DRAFT

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-mono text-xl font-bold md:text-2xl">{order.reference}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{showStore ? `${order.store.name}, from ${order.supplier.name}` : `From ${order.supplier.name}`}</span>
            <PurchaseOrderStatusBadge status={order.status} />
            {order.isOverdue && <Badge variant="destructive">Overdue</Badge>}
          </div>
        </div>
        <BackButton link={backTo} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="grid auto-rows-max gap-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>{isGhs ? `In GHS, as invoiced. Buy prices are set in USD at ${order.exchangeRate}.` : "In USD, as invoiced."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    {showsReceived && <TableHead className="text-right">Received</TableHead>}
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="whitespace-normal">
                        <div className="grid">
                          <span>{line.productName}</span>
                          <span className="text-xs text-muted-foreground">
                            {[line.variantDescription, line.sku, line.stock === null ? "Stock not tracked" : `${line.stock} in stock now`].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{line.quantityOrdered}</TableCell>
                      {showsReceived && (
                        <TableCell className="text-right tabular-nums">
                          <span className={line.quantityReceived < line.quantityOrdered ? "text-muted-foreground" : undefined}>{line.quantityReceived}</span>
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums">
                        <div className="grid">
                          <span>{money(line.unitCost)}</span>
                          {isGhs && order.exchangeRate && <span className="text-xs text-muted-foreground">{formatCurrency(line.unitCostUsd, "USD", "en-US")}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(line.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator />
              <div className="ml-auto grid w-full max-w-xs gap-1.5">
                <TotalRow label="Items" amount={money(order.subtotal)} />
                <TotalRow label="Shipping" amount={money(order.shippingCost)} />
                <Separator className="my-1" />
                <TotalRow label="Total" amount={money(order.total)} strong />
                {isGhs && order.exchangeRate && (
                  <p className="text-right text-xs text-muted-foreground">{`About ${formatCurrency(String(Number(order.total) / Number(order.exchangeRate)), "USD", "en-US")} at ${order.exchangeRate}`}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Orders, deliveries and changes, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-4">
                {timeline.map((entry) => (
                  <li key={entry.id} className="grid gap-0.5 border-l-2 pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{entry.title}</span>
                      <span className="text-xs text-muted-foreground">{`${dateTime(entry.createdAt)}${entry.by ? ` · ${entry.by}` : ""}`}</span>
                    </div>
                    {entry.notes.map((note) => (
                      <p key={note} className="text-sm text-muted-foreground">
                        {note}
                      </p>
                    ))}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="grid auto-rows-max gap-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>{STATUS_DESCRIPTIONS[order.status]}</CardDescription>
            </CardHeader>
            <CardContent>{statusContent}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supplier</CardTitle>
              {order.supplier.isArchived && <CardDescription>Archived: it can&apos;t be chosen for new orders.</CardDescription>}
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Detail label="Name">{order.supplier.name}</Detail>
              <Detail label="Contact">{order.supplier.contactName ?? notGiven}</Detail>
              <Detail label="Email">{order.supplier.email ?? notGiven}</Detail>
              <Detail label="Phone">{order.supplier.phone ?? notGiven}</Detail>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Detail label="Status">{PURCHASE_ORDER_STATUS_LABELS[order.status]}</Detail>
              <Detail label="Currency">{order.currency}</Detail>
              <Detail label="Expected on">{order.expectedOn ? <span className={order.isOverdue ? "text-destructive" : undefined}>{formatDay(order.expectedOn)}</span> : notGiven}</Detail>
              {isGhs && <Detail label="Exchange rate">{order.exchangeRate ?? <span className="text-muted-foreground">Set when ordered</span>}</Detail>}
              <Detail label="Created">{dateTime(order.createdAt)}</Detail>
              {order.orderedAt && <Detail label="Ordered">{dateTime(order.orderedAt)}</Detail>}
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
    </div>
  )
}
