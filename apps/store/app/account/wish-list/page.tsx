import type { Metadata } from "next"
import Link from "next/link"
import { Heart } from "lucide-react"
import { prisma } from "@workspace/db"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

import { WishListGrid, type WishListGridItem } from "@/components/wish-list/wish-list-grid"
import { queryProductCards } from "@/lib/data/product-cards"
import { priceCards } from "@/lib/pricing"
import { requireCustomer } from "@/lib/session"
import { getShelfPricing } from "@/lib/settings"
import { getWishList } from "@/lib/wish-list"
import { EmptyState } from "@workspace/ui/components/empty-state"

export const metadata: Metadata = { title: "Wish list", robots: { index: false } }

// What the customer has saved, newest first, at today's prices and stock
export default async function WishListPage() {
  const session = await requireCustomer("/account/wish-list")
  const entries = await getWishList(prisma, session.user.id)

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState icon={Heart} title="Your wish list is empty" description="Tap the heart on a product to save it here for later.">
            <Button render={<Link href="/" />} variant="outline" size="sm">
              Start shopping
            </Button>
          </EmptyState>
        </CardContent>
      </Card>
    )
  }

  const [cards, pricing] = await Promise.all([queryProductCards({ productIds: [...new Set(entries.map((entry) => entry.productId))] }), getShelfPricing()])
  const byId = new Map(priceCards(cards, pricing).map((card) => [card.id, card]))
  const items = entries.map((entry): WishListGridItem => {
    const card = byId.get(entry.productId)
    // A saved variant gets its card only while that variant is on sale
    if (card && (!entry.variantId || card.offers.some((offer) => offer.variantId === entry.variantId))) return { entry, card }
    return { entry, card: null, otherOptionsOnSale: !!card }
  })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {entries.length} saved {entries.length === 1 ? "item" : "items"}
      </p>
      <WishListGrid items={items} />
    </div>
  )
}
