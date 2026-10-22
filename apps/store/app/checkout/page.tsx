import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Info } from "lucide-react"
import { getPricingContext } from "@workspace/commerce/exchange-rates"
import { describeInstallationAreas } from "@workspace/commerce/installation-areas"
import { PAYMENT_WINDOW_MINUTES } from "@workspace/commerce/online-payments"
import { OrderItemError } from "@workspace/commerce/order-writes"
import { prisma } from "@workspace/db"

import { SyncBasketCount } from "@/components/basket/basket-count"
import { type CheckoutAccount, CheckoutForm, type SavedAddressOption } from "@/components/checkout/checkout-form"
import { legalLinks } from "@/components/legal-consent"
import { getSavedAddresses } from "@/lib/addresses"
import { readCartId } from "@/lib/cart-cookie"
import { CheckoutError, priceCheckout } from "@/lib/checkout"
import { getDeliveryAreas } from "@/lib/delivery-areas"
import { getStoreSession, getTradeTerms } from "@/lib/session"
import { getInstallationAreas, getLegalPages } from "@/lib/settings"

export const metadata: Metadata = { title: "Checkout", robots: { index: false } }

export default async function CheckoutPage() {
  const [cartId, pricing, session, legal, installationAreas] = await Promise.all([readCartId(), getPricingContext(), getStoreSession(), getLegalPages(), getInstallationAreas()])
  // Without a rate to sell at, the basket says so
  if (!cartId || !pricing) redirect("/basket")

  const trade = await getTradeTerms()
  const checkout = await priceCheckout(prisma, cartId, pricing, null, trade).catch((error) => {
    if (error instanceof CheckoutError || error instanceof OrderItemError) return null
    throw error
  })
  if (!checkout) redirect("/basket")

  // Only the towns there's a delivery fee for (a town's own, or its region's)
  const { areas, deliversTo } = await getDeliveryAreas()

  // Signed in: the account's details and saved addresses fill the form in
  let account: CheckoutAccount | null = null
  let savedAddresses: SavedAddressOption[] = []
  if (session) {
    const [user, addresses] = await Promise.all([prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, phone: true } }), getSavedAddresses(session.user.id)])
    account = { name: user?.name ?? session.user.name, email: user?.email ?? session.user.email, phone: user?.phone ?? "" }
    savedAddresses = addresses.map((address) => ({ ...address, line2: address.line2 ?? "", deliverable: deliversTo(address.region, address.town) }))
  }

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

      <CheckoutForm
        lines={checkout.basket.lines}
        areas={areas}
        initialSummary={checkout.summary}
        paymentMinutes={PAYMENT_WINDOW_MINUTES}
        account={account}
        savedAddresses={savedAddresses}
        legal={legalLinks(legal)}
        installationAreas={checkout.basket.lines.some((line) => line.withInstallation) ? describeInstallationAreas(installationAreas) : null}
      />
    </div>
  )
}
