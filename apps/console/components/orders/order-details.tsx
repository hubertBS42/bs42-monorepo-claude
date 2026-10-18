/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */
import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrency } from "@workspace/utils/currency"
import { formatDate } from "@workspace/utils/date"
import { returnLabel } from "@/lib/order-status"
import type { OrderLine, OrderReturnEntry, OrderTimelineEntry, OrderTotals } from "@/types"

// The parts of an order's details page that the store's and the platform's pages share

export const ghs = (amount: string) => formatCurrency(amount, "GHS", "en-GH")

// A label and value pair, as on the other details pages
export const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="text-sm font-medium">{children}</div>
  </div>
)

export const TotalRow = ({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) => (
  <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-sm"}>
    <span className={strong ? undefined : "text-muted-foreground"}>{label}</span>
    <span>{amount}</span>
  </div>
)

// showStore names each line's store, for an order with more than one store's items
export function OrderLinesTable({ lines, showStore }: { lines: OrderLine[]; showStore?: boolean }) {
  return (
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
        {lines.map((line) => (
          <TableRow key={line.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="size-10 shrink-0 overflow-hidden rounded bg-muted">{line.productImage && <img alt="" src={line.productImage} className="size-full object-cover" />}</div>
                <div className="grid gap-0.5">
                  <span>{line.productName}</span>
                  {line.variantDescription && <span className="text-xs text-muted-foreground">{line.variantDescription}</span>}
                  {line.sku && <span className="font-mono text-[11px] text-muted-foreground">{line.sku}</span>}
                  {showStore && <span className="text-[11px] text-muted-foreground">{`From ${line.storeName}`}</span>}
                  {line.returnedQuantity > 0 && <span className="text-xs text-muted-foreground">{line.returnedQuantity === line.quantity ? "Returned" : `${line.returnedQuantity} returned`}</span>}
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
  )
}

export function OrderTotalsSummary({ totals, exchangeRate }: { totals: OrderTotals; exchangeRate: string }) {
  return (
    <div className="ml-auto grid w-full max-w-xs gap-1.5">
      <TotalRow label="Subtotal" amount={ghs(totals.subtotalGhs)} />
      {/* A zero discount isn't one */}
      {totals.discountAmountGhs && Number(totals.discountAmountGhs) > 0 && (
        <TotalRow label={`Discount${totals.discountType === "PERCENTAGE" && totals.discountValue ? ` (${Number(totals.discountValue)}%)` : ""}`} amount={`−${ghs(totals.discountAmountGhs)}`} />
      )}
      {totals.discountReason && <p className="text-right text-xs text-muted-foreground">{totals.discountReason}</p>}
      <TotalRow label="Shipping" amount={ghs(totals.shippingGhs)} />
      <TotalRow label={`Tax${Number(totals.taxRate) ? ` (${(Number(totals.taxRate) * 100).toFixed(2).replace(/\.?0+$/, "")}%)` : ""}`} amount={ghs(totals.taxGhs)} />
      <Separator className="my-1" />
      <TotalRow label="Total" amount={ghs(totals.totalGhs)} strong />
      <p className="text-right text-xs text-muted-foreground">{`At GH₵${Number(exchangeRate)} per $1`}</p>
    </div>
  )
}

export function OrderTimelineCard({ timeline }: { timeline: OrderTimelineEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
        <CardDescription>Every status change, payment and return, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No status changes yet.</p>
        ) : (
          <ol className="grid gap-4">
            {timeline.map((entry) => (
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
  )
}

interface OrderCustomerCardProps {
  customer: { name: string; email: string | null; phone: string | null; isRegistered: boolean }
  shipping: { name: string | null; phone: string | null; line1: string | null; line2: string | null; region: string | null; town: string | null } | null
  // Edit buttons, when the order can still be edited
  actions?: ReactNode
}

export function OrderCustomerCard({ customer, shipping, actions }: OrderCustomerCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer</CardTitle>
        <CardDescription>{`${customer.isRegistered ? "Has an account" : "Walk-in, without an account"} · ${shipping ? "Delivery" : "Pickup"}`}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Detail label="Name">{customer.name}</Detail>
        <Detail label="Email">{customer.email ?? <span className="text-muted-foreground">Not given</span>}</Detail>
        <Detail label="Phone">{customer.phone ?? <span className="text-muted-foreground">Not given</span>}</Detail>
        <Separator />
        {shipping ? (
          <>
            <Detail label="Deliver to">{[shipping.name, shipping.phone].filter(Boolean).join(" · ") || "—"}</Detail>
            <Detail label="Address">{[shipping.line1, shipping.line2, shipping.town, shipping.region].filter(Boolean).join(", ") || "—"}</Detail>
          </>
        ) : (
          <Detail label="Pickup">The customer collects the order from the store.</Detail>
        )}
        {actions && <div className="flex flex-wrap gap-1">{actions}</div>}
      </CardContent>
    </Card>
  )
}

// Shown when there are notes, or when they can still be added (actions)
export function OrderNotesCard({ notes, actions }: { notes: string | null; actions?: ReactNode }) {
  if (!notes && !actions) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>For staff, not the customer.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {notes ? <p className="text-sm whitespace-pre-line">{notes}</p> : <p className="text-sm text-muted-foreground">No notes.</p>}
        {actions}
      </CardContent>
    </Card>
  )
}

// The lines' return label for the page header
export const returnState = (lines: OrderLine[]) =>
  returnLabel(
    lines.reduce((sum, line) => sum + line.quantity, 0),
    lines.reduce((sum, line) => sum + line.returnedQuantity, 0)
  )

// The platform's record of items brought back; actions holds the Record return button
export function OrderReturnsCard({ returns, actions }: { returns: OrderReturnEntry[]; actions?: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Returns</CardTitle>
        <CardDescription>Items the customer brought back. Shipping isn&apos;t refunded.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {returns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has been returned.</p>
        ) : (
          <ol className="grid gap-4">
            {returns.map((entry) => (
              <li key={entry.id} className="grid gap-1 border-l-2 pl-4">
                <span className="text-xs text-muted-foreground">{`${formatDate(entry.createdAt, "MMM d, yyyy, h:mm a")}${entry.recordedBy ? ` · ${entry.recordedBy}` : ""}`}</span>
                <ul className="grid gap-0.5 text-sm">
                  {entry.items.map((item, index) => (
                    <li key={index}>
                      {`${item.quantity} × ${item.productName}${item.variantDescription ? ` (${item.variantDescription})` : ""}`}
                      <span className="text-muted-foreground">{item.restocked ? " · back in stock" : " · not restocked"}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">{entry.reason}</p>
                <p className="text-sm">{entry.refundGhs ? `Refunded ${ghs(entry.refundGhs)}` : "No refund"}</p>
              </li>
            ))}
          </ol>
        )}
        {actions}
      </CardContent>
    </Card>
  )
}
