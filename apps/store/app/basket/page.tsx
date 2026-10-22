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
import { getFreeDeliveryFrom, getInstallationAreas } from "@/lib/settings"

export const metadata: Metadata = { title: "Basket", robots: { index: false } }

export default async function BasketPage() {
  const cartId = await readCartId()
  // Priced fresh, not from the shelf's minute-long cache: this is what checkout will charge
  const [pricing, freeDeliveryFrom, installationAreas] = await Promise.all([getPricingContext(), getFreeDeliveryFrom(), getInstallationAreas()])
  const basket = cartId ? await loadCart(prisma, cartId, pricing) : null
  const lines = basket?.lines ?? []

  // How much more would deliver free. The threshold counts the subtotal before tax, and shown prices include it, so the
  // shortfall is shown with tax too, rounded up to the cent so spending it is always enough.
  const shortBeforeTax = basket?.totals && freeDeliveryFrom ? new Prisma.Decimal(freeDeliveryFrom).minus(basket.totals.subtotalGhs) : null
  const toFreeDelivery = shortBeforeTax && pricing?.tax ? shortBeforeTax.times(pricing.tax.rate.plus(1)).toDecimalPlaces(2, Prisma.Decimal.ROUND_UP) : shortBeforeTax

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
              <BasketLine key={line.id} line={line} />
            ))}
          </ul>

          <Card className="lg:sticky lg:top-36">
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {basket?.totals ? (
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
                  {basket.totals.installationGhs && (
                    <p className="text-muted-foreground">We install in {describeInstallationAreas(installationAreas) ?? "a few towns"} and call you to arrange a day.</p>
                  )}
                  {toFreeDelivery &&
                    (toFreeDelivery.gt(0) ? (
                      <>
                        <Separator />
                        <p className="text-muted-foreground">Spend {formatGhs(toFreeDelivery.toFixed(2))} more for free delivery.</p>
                      </>
                    ) : (
                      <>
                        <Separator />
                        <p className="font-medium text-green-700 dark:text-green-500">Your order qualifies for free delivery.</p>
                      </>
                    ))}
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
