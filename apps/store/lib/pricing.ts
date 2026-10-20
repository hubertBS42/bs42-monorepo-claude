import "server-only"

import { shelfPrice } from "@workspace/commerce/pricing"
import { Prisma } from "@workspace/db/client"

import type { PricedCard, ProductCardData } from "@/lib/product-cards"
import type { ShelfPricing } from "@/lib/settings"

// Shown prices in GHS at today's rate, with tax when it's on, as an order would charge them. Without a rate recent
// enough to sell at, offers have no price.
export function priceCards(cards: ProductCardData[], pricing: ShelfPricing | null): PricedCard[] {
  if (!pricing) return cards.map((card) => ({ ...card, offers: card.offers.map((offer) => ({ ...offer, price: null })) }))

  const rate = new Prisma.Decimal(pricing.exchangeRate)
  const taxRate = pricing.taxRate ? new Prisma.Decimal(pricing.taxRate) : null
  return cards.map((card) => ({
    ...card,
    offers: card.offers.map((offer) => {
      const price = shelfPrice(new Prisma.Decimal(offer.priceUsd), rate, taxRate)
      const was = offer.compareAtUsd ? shelfPrice(new Prisma.Decimal(offer.compareAtUsd), rate, taxRate) : null
      return { ...offer, price: { ghs: price.incTaxGhs.toFixed(2), exTaxGhs: taxRate ? price.exTaxGhs.toFixed(2) : null, wasGhs: was?.incTaxGhs.toFixed(2) ?? null } }
    }),
  }))
}
