import type { Metadata } from "next"
import Link from "next/link"
import { FileText, Package } from "lucide-react"
import { quoteHref } from "@workspace/commerce/order-links"
import { prisma } from "@workspace/db"
import { QuoteStatus } from "@workspace/db/enums"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { formatDate } from "@workspace/utils/date"

import { formatGhs } from "@/lib/money"
import { isExpired, quoteOwnerWhere } from "@workspace/commerce/quotes"
import { MAX_OPEN_QUOTES } from "@/lib/quotes"
import { requireCustomer } from "@/lib/session"

export const metadata: Metadata = { title: "Quotations", robots: { index: false } }

// The account's quotations, newest first. Few enough (5 open at most) that the last 50 is all of them that matter.
export default async function AccountQuotesPage() {
  const session = await requireCustomer("/account/quotes")
  const quotes = await prisma.quote.findMany({
    // Those it made, and those staff made for its email
    where: quoteOwnerWhere(session.user),
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      reference: true,
      status: true,
      validUntil: true,
      totalGhs: true,
      createdAt: true,
      tradeCompanyName: true,
      items: { orderBy: { id: "asc" }, take: 4, select: { id: true, productName: true, productImage: true } },
      _count: { select: { items: true } },
    },
  })

  if (quotes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <FileText className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No quotations yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Fill your basket and choose &ldquo;Get a quote&rdquo; for a quotation to print or forward for approval.</p>
          <Button render={<Link href="/basket" />} className="mt-2">
            Go to your basket
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{`You can make up to ${MAX_OPEN_QUOTES} open quotations at once. Quotations we prepare for you don't count.`}</p>
      <ul className="flex flex-col gap-3">
        {quotes.map((quote) => {
          const expired = isExpired(quote)
          const lastDay = formatDate(new Date(quote.validUntil.getTime() - 1), "d MMM yyyy")
          const status = quote.status === QuoteStatus.ACCEPTED ? "Accepted" : quote.status === QuoteStatus.CANCELLED ? "Cancelled" : expired ? "Expired" : `Valid until ${lastDay}`
          return (
            <li key={quote.id}>
              <Link
                href={quoteHref(quote.reference, quote.id)}
                className="block rounded-xl transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Card className="bg-transparent">
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{quote.reference}</span>
                        <Badge variant={quote.status === QuoteStatus.OPEN && !expired ? "default" : "secondary"}>{status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(quote.createdAt, "d MMM yyyy")} · {quote._count.items === 1 ? "1 line" : `${quote._count.items} lines`} · {formatGhs(quote.totalGhs.toFixed(2))}
                        {quote.tradeCompanyName && ` · ${quote.tradeCompanyName}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2" aria-hidden>
                      {quote.items.map((item) => (
                        <div key={item.id} className="flex size-12 items-center justify-center overflow-hidden rounded-md border bg-muted" title={item.productName}>
                          {item.productImage ? (
                            // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
                            <img src={item.productImage} alt="" className="size-full object-contain p-1" />
                          ) : (
                            <Package className="size-4 text-muted-foreground/40" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
