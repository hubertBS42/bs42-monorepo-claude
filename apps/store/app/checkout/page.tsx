import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Info } from "lucide-react"
import { findDeliveryRate } from "@workspace/commerce/delivery-rates"
import { loadDeliverySettings } from "@workspace/commerce/delivery"
import { getPricingContext } from "@workspace/commerce/exchange-rates"
import { PAYMENT_WINDOW_MINUTES } from "@workspace/commerce/online-payments"
import { OrderItemError } from "@workspace/commerce/order-writes"
import { GEODATA } from "@workspace/contracts"
import { prisma } from "@workspace/db"

import { SyncBasketCount } from "@/components/basket/basket-count"
import { CheckoutForm, type DeliveryArea } from "@/components/checkout/checkout-form"
import { readCartId } from "@/lib/cart-cookie"
import { CheckoutError, priceCheckout } from "@/lib/checkout"

export const metadata: Metadata = { title: "Checkout", robots: { index: false } }

export default async function CheckoutPage() {
  const [cartId, pricing] = await Promise.all([readCartId(), getPricingContext()])
  // Without a rate to sell at, the basket says so
  if (!cartId || !pricing) redirect("/basket")

  const checkout = await priceCheckout(prisma, cartId, pricing, null).catch((error) => {
    if (error instanceof CheckoutError || error instanceof OrderItemError) return null
    throw error
  })
  if (!checkout) redirect("/basket")

  // Only the towns there's a delivery fee for (a town's own, or its region's)
  const { rates } = await loadDeliverySettings(prisma)
  const areas: DeliveryArea[] = GEODATA.map((region) => ({ region: region.name, towns: region.towns.filter((town) => findDeliveryRate(rates, region.name, town)) })).filter(
    (area) => area.towns.length > 0
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <SyncBasketCount count={checkout.basket.count} />
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Checkout</h1>
        <Link href="/basket" className="text-sm text-muted-foreground hover:text-foreground">
          Back to basket
        </Link>
      </div>

      {checkout.basket.notices.length > 0 && (
        <ul className="mb-6 space-y-2">
          {checkout.basket.notices.map((notice) => (
            <li key={notice} className="flex gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              {notice}
            </li>
          ))}
        </ul>
      )}

      <CheckoutForm lines={checkout.basket.lines} areas={areas} initialSummary={checkout.summary} paymentMinutes={PAYMENT_WINDOW_MINUTES} />
    </div>
  )
}
