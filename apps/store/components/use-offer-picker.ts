"use client"

import { useState } from "react"

import type { PricedCard, PricedOffer } from "@/lib/product-cards"

// Picking a product's variant by its option values, on a card or the product page. Every value shown belongs to some
// offer, so a pick always lands on one: it keeps the other options' values when that variant is on sale, else takes
// the first offer with the value (the best, as offers are in order).
export function useOfferPicker(card: PricedCard, initialVariantId?: string | null) {
  const [offer, setOffer] = useState<PricedOffer>(() => card.offers.find((candidate) => candidate.variantId === initialVariantId) ?? card.offers[0]!)

  const options = card.options.map((option) => {
    // This option's value on the current offer, and the other options' values
    const selected = option.values.find((value) => offer.optionValueIds.includes(value.id)) ?? null
    const others = offer.optionValueIds.filter((id) => !option.values.some((value) => value.id === id))
    const find = (valueId: string, keep: string[]) => card.offers.find((candidate) => candidate.optionValueIds.includes(valueId) && keep.every((id) => candidate.optionValueIds.includes(id)))
    return {
      name: option.name,
      values: option.values.map((value) => ({
        ...value,
        selected: selected?.id === value.id,
        // Whether this value with the other options as they are is a variant on sale
        available: !!find(value.id, others),
        pick: () => {
          const next = find(value.id, others) ?? find(value.id, [])
          if (next) setOffer(next)
          return next ?? offer
        },
      })),
    }
  })

  return { offer, options }
}
