import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { isQuoteKey, orderHref } from "@workspace/commerce/order-links"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { QuoteStatus } from "@workspace/db/enums"
import { Badge } from "@workspace/ui/components/badge"
import { formatDate } from "@workspace/utils/date"
import { getStringParam } from "@workspace/utils/search-params"

import { PrintButton } from "@/components/orders/print-button"
import { AcceptQuoteButton, CancelQuoteButton, QuoteToBasketButton } from "@/components/quotes/quote-actions"
import type { SearchParams } from "@/lib/catalogue-filters"
import { formatGhs } from "@/lib/money"
import { isExpired } from "@/lib/quotes"
import { getStoreSession } from "@/lib/session"
import { getAppSettings, getStoreName } from "@/lib/settings"

export const metadata: Metadata = { title: "Quotation", robots: { index: false } }

type QuotePageProps = {
  params: Promise<{ reference: string }>
  searchParams: Promise<SearchParams>
}

const money = (amount: Prisma.Decimal) => formatGhs(amount.toFixed(2))

function TotalRow({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-8 border-t pt-2 text-base font-semibold" : "flex justify-between gap-8"}>
      <span className={strong ? undefined : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{amount}</span>
    </div>
  )
}

// A quotation, laid out for printing like the invoice, behind its signed link so it can be forwarded to whoever
// approves the purchase. Only the account that made it can accept or cancel it.
export default async function QuotePage({ params, searchParams }: QuotePageProps) {
  const [{ reference }, query] = await Promise.all([params, searchParams])
  const key = getStringParam(query.key)

  const quote = await prisma.quote.findUnique({
    where: { reference },
    include: { items: { orderBy: { id: "asc" } }, order: { select: { id: true, reference: true } } },
  })
  // The same answer for a wrong key as for no quote, so references can't be probed
  if (!quote || !key || !isQuoteKey(quote.id, key)) notFound()

  const [settings, storeName, session] = await Promise.all([getAppSettings(), getStoreName(), getStoreSession()])
  const isOwner = !!session && session.user.id === quote.userId
  const expired = isExpired(quote)
  const isOpen = quote.status === QuoteStatus.OPEN && !expired
  // validUntil is the start of the day after the last one its prices hold
  const lastDay = formatDate(new Date(quote.validUntil.getTime() - 1), "d MMMM yyyy")
  const discount = quote.discountAmountGhs?.gt(0) ? quote.discountAmountGhs : null
  const address = [quote.shippingLine1, quote.shippingLine2, quote.shippingTown, quote.shippingRegion].filter(Boolean).join(", ")
  const status = quote.status === QuoteStatus.ACCEPTED ? "Accepted" : quote.status === QuoteStatus.CANCELLED ? "Cancelled" : expired ? "Expired" : `Valid until ${lastDay}`

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6 print:max-w-none print:p-0">
      <div className="mb-6 space-y-4 print:hidden">
        {isOwner && (
          <Link href="/account/quotes" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            Quotations
          </Link>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant={isOpen ? "default" : "secondary"}>{status}</Badge>
          <PrintButton />
        </div>
        {isOwner && isOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border p-4">
            <div className="mr-auto text-sm">
              <p className="font-medium">Ready to order?</p>
              <p className="text-muted-foreground">We&apos;ll check everything is still in stock, then you pay as at checkout.</p>
            </div>
            <CancelQuoteButton quoteId={quote.id} />
            <AcceptQuoteButton quoteId={quote.id} label={`Accept and pay ${money(quote.totalGhs)}`} />
          </div>
        )}
        {isOwner && (expired || quote.status === QuoteStatus.CANCELLED) && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm">
            <p className="mr-auto text-muted-foreground">{expired ? "This quotation's prices no longer hold." : "You cancelled this quotation."} You can buy the same items at today&apos;s prices.</p>
            <QuoteToBasketButton quoteId={quote.id} quoteKey={key} />
          </div>
        )}
        {isOwner && quote.order && (
          <p className="text-sm text-muted-foreground">
            Accepted as order{" "}
            <Link href={orderHref(quote.order.reference, quote.order.id)} className="font-mono text-foreground underline underline-offset-4">
              {quote.order.reference}
            </Link>
            .
          </p>
        )}
        {!isOwner && isOpen && <p className="text-sm text-muted-foreground">Only the account that made this quotation can accept it.</p>}
      </div>

      <article className="rounded-xl border bg-card p-6 text-sm md:p-10 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            {settings.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
              <img src={settings.logoUrl} alt={storeName} className="h-10 w-auto" />
            ) : (
              <p className="text-lg font-bold">{storeName}</p>
            )}
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold tracking-tight">Quotation</h1>
            <p className="font-mono">{quote.reference}</p>
            <p className="text-muted-foreground">{formatDate(quote.createdAt, "d MMMM yyyy")}</p>
            <p className="font-medium">Valid until {lastDay}</p>
          </div>
        </header>

        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="space-y-0.5">
            <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Prepared for</h2>
            {quote.tradeCompanyName && <p className="font-semibold">{quote.tradeCompanyName}</p>}
            {quote.tradeTin && <p>TIN {quote.tradeTin}</p>}
            <p className={quote.tradeCompanyName ? undefined : "font-semibold"}>{quote.customerName}</p>
            <p>{quote.customerEmail}</p>
            <p>{quote.customerPhone}</p>
          </div>
          <div className="space-y-0.5">
            <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Deliver to</h2>
            <p>{address}</p>
          </div>
        </section>

        <table className="mt-8 w-full">
          <thead>
            <tr className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit price</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => (
              <tr key={item.id} className="border-b align-top">
                <td className="py-3 pr-4">
                  <p className="font-medium">{item.productName}</p>
                  {item.variantDescription && <p className="text-muted-foreground">{item.variantDescription}</p>}
                  {item.sku && <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>}
                  {item.installationUnitGhs && (
                    <p className="text-muted-foreground">
                      Installation, {money(item.installationUnitGhs)} each: {money(item.installationTotalGhs)}
                    </p>
                  )}
                </td>
                <td className="py-3 text-right tabular-nums">{item.quantity}</td>
                <td className="py-3 text-right tabular-nums">{money(item.unitPriceGhs)}</td>
                <td className="py-3 text-right tabular-nums">{money(item.totalPriceGhs)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 ml-auto grid max-w-xs gap-1.5">
          <TotalRow label="Subtotal" amount={money(quote.subtotalGhs)} />
          {discount && <TotalRow label={quote.discountReason ?? "Discount"} amount={`−${money(discount)}`} />}
          {quote.installationGhs.gt(0) && <TotalRow label="Installation" amount={money(quote.installationGhs)} />}
          <TotalRow label="Delivery" amount={quote.shippingGhs.isZero() ? "Free" : money(quote.shippingGhs)} />
          {quote.taxGhs.gt(0) && <TotalRow label={`Tax (${quote.taxRate.times(100).toNumber()}%)`} amount={money(quote.taxGhs)} />}
          <TotalRow label="Total" amount={money(quote.totalGhs)} strong />
        </section>

        <footer className="mt-10 space-y-1 border-t pt-4 text-muted-foreground">
          <p>{`Prices hold until ${lastDay}. Items are subject to availability until the quotation is accepted and paid.`}</p>
          <p>Amounts in Ghana cedis (GHS). Payment by mobile money or card when accepted.</p>
        </footer>
      </article>
    </div>
  )
}
