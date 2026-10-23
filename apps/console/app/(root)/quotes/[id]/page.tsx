import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"
import z from "zod"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatDate } from "@workspace/utils/date"
import QuoteActions from "./_components/quote-actions"
import BackButton from "@/components/back-button"
import { Detail, ghs, TotalRow } from "@/components/orders/order-details"
import { QUOTE_STATUS } from "@/components/quote-status"
import { requireSystemPermission } from "@/lib/auth-guard"
import { getQuoteDetails } from "@/lib/data/quotes.data"

export const metadata: Metadata = {
  title: "Quotation",
}

type QuotePageProps = {
  params: Promise<{ id: string }>
}

// One quotation, as it was quoted: who made it, the lines and amounts, and what became of it
export default async function QuotePage({ params }: QuotePageProps) {
  await requireSystemPermission({ order: ["read"] })

  const { id } = await params
  // Quote.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getQuoteDetails(id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  const quote = response.data
  const status = QUOTE_STATUS[quote.status]
  const { totals } = quote

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-mono text-xl font-bold md:text-2xl">{quote.reference}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{`Made ${formatDate(quote.createdAt, "MMM d, yyyy, h:mm a")} ${quote.createdBy ? `by ${quote.createdBy}` : "by the customer on the storefront"}`}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
            {quote.trade && <Badge variant="outline">Trade</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BackButton link="/quotes" />
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
                  <TableHead>Store</TableHead>
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
                        <span>{line.label}</span>
                        {line.sku && <span className="font-mono text-xs text-muted-foreground">{line.sku}</span>}
                        {line.installationGhs && <span className="text-xs text-muted-foreground">{`Installation ${ghs(line.installationGhs)}`}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{line.storeName}</TableCell>
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
              <TotalRow label="Delivery" amount={Number(totals.shippingGhs) > 0 ? ghs(totals.shippingGhs) : "Free"} />
              <TotalRow label={Number(totals.taxRate) ? `Tax (${+(Number(totals.taxRate) * 100).toFixed(2)}%)` : "Tax"} amount={ghs(totals.taxGhs)} />
              <Separator className="my-1" />
              <TotalRow label="Total" amount={ghs(totals.totalGhs)} strong />
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
                  <Link href={`/orders/${quote.order.id}/details`} className="font-mono hover:underline hover:underline-offset-4">
                    {quote.order.reference}
                  </Link>
                </Detail>
              )}
              <QuoteActions quote={quote} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>
                {quote.customer.hasAccount
                  ? "Has an account with this email, so they can accept it on the storefront."
                  : "No confirmed account has this email yet: they create one to accept it online."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Detail label="Name">{quote.customer.name}</Detail>
              {quote.trade && <Detail label="Company">{quote.trade.tin ? `${quote.trade.companyName} (TIN ${quote.trade.tin})` : quote.trade.companyName}</Detail>}
              <Detail label="Email">{quote.customer.email}</Detail>
              <Detail label="Phone">{quote.customer.phone}</Detail>
              <Detail label="Deliver to">{quote.address}</Detail>
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
    </main>
  )
}
