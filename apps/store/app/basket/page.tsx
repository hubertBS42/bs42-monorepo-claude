import type { Metadata } from "next"
import Link from "next/link"
import { Info, ShoppingBasket } from "lucide-react"
import { getPricingContext } from "@workspace/commerce/exchange-rates"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"

import { SyncBasketCount } from "@/components/basket/basket-count"
import { BasketLine } from "@/components/basket/basket-line"
import { loadCart } from "@/lib/cart"
import { readCartId } from "@/lib/cart-cookie"
import { formatGhs } from "@/lib/money"
import { describeInstallationAreas } from "@workspace/commerce/installation-areas"
import { QuoteRequestDialog } from "@/components/quotes/quote-request-dialog"
import { getSavedAddresses } from "@/lib/addresses"
import { getDeliveryAreas } from "@/lib/delivery-areas"
import { getStoreSession, getTradeTerms } from "@/lib/session"
import { getAppSettings, getFreeDeliveryFrom, getInstallationAreas } from "@/lib/settings"

export const metadata: Metadata = { title: "Basket", robots: { index: false } }

async function quoteRequestProps() {
  const [session, { areas, deliversTo }, settings] = await Promise.all([getStoreSession(), getDeliveryAreas(), getAppSettings()])
  const blank = { name: "", phone: "", line1: "", line2: "", region: "", town: "" }
  if (!session) return { signedIn: false, initial: blank, areas, validityDays: settings.quoteValidityDays }

  const [user, addresses] = await Promise.all([prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, phone: true } }), getSavedAddresses(session.user.id)])
  const address = addresses.find((saved) => deliversTo(saved.region, saved.town))
  const initial = address
    ? { name: address.name, phone: address.phone, line1: address.line1, line2: address.line2 ?? "", region: address.region, town: address.town }
    : { ...blank, name: user?.name ?? session.user.name, phone: user?.phone ?? "" }
  return { signedIn: true, initial, areas, validityDays: settings.quoteValidityDays }
}

export default async function BasketPage() {
  const cartId = await readCartId()
  // Priced fresh, not from the shelf's minute-long cache: this is what checkout will charge
  const [pricing, freeDeliveryFrom, installationAreas] = await Promise.all([getPricingContext(), getFreeDeliveryFrom(), getInstallationAreas()])
  const basket = cartId ? await loadCart(prisma, cartId, pricing, await getTradeTerms()) : null
  const lines = basket?.lines ?? []
  const trade = basket?.trade ?? null

  // How much more would deliver free. The threshold counts the subtotal after any trade discount, before tax. Shown
  // prices include tax (except a trade account's), so the shortfall is shown with tax too, rounded up to the cent so
  // spending it is always enough.
  const shortBeforeTax = basket?.totals && freeDeliveryFrom ? new Prisma.Decimal(freeDeliveryFrom).minus(basket.totals.thresholdGhs) : null
  const toFreeDelivery = shortBeforeTax && pricing?.tax && !trade ? shortBeforeTax.times(pricing.tax.rate.plus(1)).toDecimalPlaces(2, Prisma.Decimal.ROUND_UP) : shortBeforeTax

  // "Get a quote", filled in from the account and its default address (when it's delivered to)
  const quote = basket?.totals ? await quoteRequestProps() : null

  // Under the summary, trade account or not
  const notes = basket?.totals && (
    <>
      {basket.totals.installationGhs && <p className="text-muted-foreground">We install in {describeInstallationAreas(installationAreas) ?? "a few towns"} and call you to arrange a day.</p>}
      {toFreeDelivery &&
        (toFreeDelivery.gt(0) ? (
          <>
            <Separator />
            <p className="text-muted-foreground">
              Spend {formatGhs(toFreeDelivery.toFixed(2))} more{trade && " before tax"} for free delivery.
            </p>
          </>
        ) : (
          <>
            <Separator />
            <p className="font-medium text-green-700 dark:text-green-500">Your order qualifies for free delivery.</p>
          </>
        ))}
    </>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <SyncBasketCount count={basket?.count ?? 0} />
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Your basket</h1>

      {basket?.notices.length ? (
        <ul className="mt-6 space-y-2">
          {basket.notices.map((notice) => (
            <li key={notice} className="flex gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {notice}
            </li>
          ))}
        </ul>
      ) : null}

      {!lines.length ? (
        <div className="mt-10 flex flex-col items-start gap-4">
          <ShoppingBasket className="size-10 text-muted-foreground/50" aria-hidden />
          <p className="text-muted-foreground">Your basket is empty.</p>
          <Button render={<Link href="/" />} variant="outline">
            Continue shopping
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
          <ul className="divide-y border-y">
            {lines.map((line) => (
              <BasketLine key={line.id} line={line} exTax={!!trade} />
            ))}
          </ul>

          <Card className="lg:sticky lg:top-36">
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {basket?.totals && trade ? (
                <>
                  {/* A trade account's amounts are before tax, then its discount, then the tax */}
                  <div className="flex justify-between gap-4">
                    <span>Items ({basket.count}), ex. tax</span>
                    <span className="tabular-nums">{formatGhs(basket.totals.subtotalGhs)}</span>
                  </div>
                  {basket.totals.discountGhs && (
                    <div className="flex justify-between gap-4 text-green-700 dark:text-green-500">
                      <span>Trade discount ({Number(trade.percent)}%)</span>
                      <span className="tabular-nums">−{formatGhs(basket.totals.discountGhs)}</span>
                    </div>
                  )}
                  {basket.totals.installationGhs && (
                    <div className="flex justify-between gap-4">
                      <span>Installation</span>
                      <span className="tabular-nums">{formatGhs(basket.totals.installationGhs)}</span>
                    </div>
                  )}
                  {basket.totals.taxGhs && (
                    <div className="flex justify-between gap-4">
                      <span>Tax</span>
                      <span className="tabular-nums">{formatGhs(basket.totals.taxGhs)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between gap-4">
                    <span>Total</span>
                    <span className="font-semibold tabular-nums">{formatGhs(basket.totals.totalGhs)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Delivery</span>
                    <span>Worked out at checkout</span>
                  </div>
                  {notes}
                </>
              ) : basket?.totals ? (
                <>
                  <div className="flex justify-between gap-4">
                    <span>
                      Subtotal ({basket.count} {basket.count === 1 ? "item" : "items"})
                    </span>
                    <span className="font-semibold tabular-nums">{formatGhs(basket.totals.totalGhs)}</span>
                  </div>
                  {basket.totals.installationGhs && (
                    <div className="flex justify-between gap-4 text-muted-foreground">
                      <span>Includes installation</span>
                      <span className="tabular-nums">{formatGhs(basket.totals.installationGhs)}</span>
                    </div>
                  )}
                  {basket.totals.taxGhs && (
                    <div className="flex justify-between gap-4 text-muted-foreground">
                      <span>Includes tax</span>
                      <span className="tabular-nums">{formatGhs(basket.totals.taxGhs)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Delivery</span>
                    <span>Worked out at checkout</span>
                  </div>
                  {notes}
                </>
              ) : (
                <p className="text-muted-foreground">We're updating our prices. Please check back in a little while to place your order.</p>
              )}
            </CardContent>
            <CardFooter className="flex-col gap-2">
              {basket?.totals ? (
                <Button render={<Link href="/checkout" />} size="lg" className="w-full">
                  Go to checkout
                </Button>
              ) : (
                <Button size="lg" className="w-full" disabled>
                  Go to checkout
                </Button>
              )}
              {quote && <QuoteRequestDialog {...quote} />}
              <Button render={<Link href="/" />} variant="ghost" className="w-full">
                Continue shopping
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
