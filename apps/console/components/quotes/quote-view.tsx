import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatDate } from "@workspace/utils/date"
import { formatPhoneNumber } from "@workspace/utils/phone"
import BackButton from "@/components/back-button"
import { Detail, ghs, TotalRow } from "@/components/orders/order-details"
import QuoteActions from "@/components/quotes/quote-actions"
import { QUOTE_STATUS } from "@/components/quote-status"
import type { QuoteDetails } from "@/types"

// One quotation, as it was quoted: who made it, the lines and amounts, and what became of it. storeId is the store's
// page; null the platform's.
export default function QuoteView({ quote, storeId }: { quote: QuoteDetails; storeId: string | null }) {
  const status = QUOTE_STATUS[quote.status]
  const { totals } = quote

  return (
    <div className="flex flex-col gap-y-6">
      {/* The buttons go under the reference on phones, which it needs the whole width for (and never breaks at its hyphens) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <h1 className="font-mono text-xl font-bold whitespace-nowrap md:text-2xl">{quote.reference}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{`Made ${formatDate(quote.createdAt, "MMM d, yyyy, h:mm a")} ${quote.createdBy ? `by ${quote.createdBy}${!storeId && quote.storeName ? ` of ${quote.storeName}` : ""}` : "by the customer on the storefront"}`}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
            {quote.trade && <Badge variant="outline">Trade</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BackButton link={storeId ? "/store/quotes" : "/quotes"} />
          <Button render={<a href={quote.url} target="_blank" rel="noopener noreferrer" />} variant="outline" size="sm">
            <ExternalLink data-icon="inline-start" aria-hidden />
            View on storefront
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <CardDescription>{`In GHS at GH₵${Number(quote.exchangeRate)} per $1, the rate it was quoted at.`}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  {!storeId && <TableHead>Store</TableHead>}
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="whitespace-normal">
                      <div className="grid">
                        {line.href ? (
                          <Link href={line.href} className="w-fit underline-offset-4 hover:underline">
                            {line.label}
                          </Link>
                        ) : (
                          <span>{line.label}</span>
                        )}
                        {line.sku && <span className="font-mono text-xs text-muted-foreground">{line.sku}</span>}
                        {line.installationGhs && <span className="text-xs text-muted-foreground">{`Installation ${ghs(line.installationGhs)}`}</span>}
                      </div>
                    </TableCell>
                    {!storeId && <TableCell className="text-muted-foreground">{line.storeName}</TableCell>}
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell className="text-right">{ghs(line.unitPriceGhs)}</TableCell>
                    <TableCell className="text-right">{ghs(line.totalPriceGhs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Separator />
            <div className="ml-auto grid w-full max-w-xs gap-1.5">
              <TotalRow label="Subtotal" amount={ghs(totals.subtotalGhs)} />
              {totals.discountAmountGhs && <TotalRow label={totals.discountReason ?? "Discount"} amount={`−${ghs(totals.discountAmountGhs)}`} />}
              {Number(totals.installationGhs) > 0 && <TotalRow label="Installation" amount={ghs(totals.installationGhs)} />}
              {!quote.isPickup && <TotalRow label="Delivery" amount={quote.deliveryToConfirm ? "To be confirmed" : Number(totals.shippingGhs) > 0 ? ghs(totals.shippingGhs) : "Free"} />}
              <TotalRow label={Number(totals.taxRate) ? `Tax (${+(Number(totals.taxRate) * 100).toFixed(2)}%)` : "Tax"} amount={ghs(totals.taxGhs)} />
              <Separator className="my-1" />
              <TotalRow label={quote.deliveryToConfirm ? "Total before delivery" : "Total"} amount={ghs(totals.totalGhs)} strong />
            </div>
          </CardContent>
        </Card>

        <div className="grid auto-rows-max gap-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>
                {quote.status === "open"
                  ? `Prices hold until the end of ${formatDate(quote.validUntil, "MMM d, yyyy")}.`
                  : quote.status === "expired"
                    ? `Its prices held until the end of ${formatDate(quote.validUntil, "MMM d, yyyy")}.`
                    : quote.status === "accepted"
                      ? "Accepted, as an order."
                      : "Cancelled: it can't be accepted."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {quote.order && (
                <Detail label="Order">
                  <Link href={`${storeId ? "/store" : ""}/orders/${quote.order.id}/details`} className="font-mono hover:underline hover:underline-offset-4">
                    {quote.order.reference}
                  </Link>
                </Detail>
              )}
              {!storeId && quote.storeId ? (
                // A full page load: the link switches workspace
                <a href={`/store/quotes/${quote.id}?workspace=${quote.storeId}`} className={buttonVariants({ variant: "outline" })}>
                  {`Open in ${quote.storeName}`}
                </a>
              ) : storeId && quote.hasPlatformInstallation ? (
                <p className="text-sm text-muted-foreground">Includes installation, so the platform handles it.</p>
              ) : (
                <QuoteActions quote={quote} storeId={storeId} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>{quote.customer.hasAccount ? "Has an account, so they can accept it online." : "No account yet: they need one to accept online."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Detail label="Name">{quote.customer.name}</Detail>
              {quote.trade && <Detail label="Company">{quote.trade.tin ? `${quote.trade.companyName} (TIN ${quote.trade.tin})` : quote.trade.companyName}</Detail>}
              <Detail label="Email">{quote.customer.email}</Detail>
              <Detail label="Phone">{formatPhoneNumber(quote.customer.phone)}</Detail>
              <Detail label={quote.isPickup ? "Pickup from" : "Deliver to"}>{quote.isPickup ? quote.lines[0]?.storeName : quote.address}</Detail>
            </CardContent>
          </Card>

          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Note to the customer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{quote.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
