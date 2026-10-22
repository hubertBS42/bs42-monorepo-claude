"use client"

import { cn } from "@workspace/ui/lib/utils"

import { useTradePercent } from "@/components/trade/trade-state"
import { formatGhs } from "@/lib/money"
import type { PricedOffer } from "@/lib/product-cards"
import { tradeShelfPrice } from "@/lib/trade-price"
import { stockLine, type StockTone } from "@/lib/stock-line"

const TONE_CLASSES: Record<StockTone, string> = { good: "bg-green-600", low: "bg-amber-500", out: "bg-muted-foreground/50" }

// An offer's price (with tax when it's on, the ex-tax price under it, and the old price on a sale), on a card or the
// product page. A trade account sees its own price before tax, with the usual price under it.
export function OfferPrice({ offer, size = "sm" }: { offer: PricedOffer; size?: "sm" | "lg" }) {
  const tradePercent = useTradePercent()
  if (!offer.price) return <p className="text-sm text-muted-foreground">Price coming soon</p>
  if (tradePercent !== null) {
    return (
      <div>
        <p className={cn("font-bold tabular-nums", size === "lg" ? "text-3xl" : "text-lg")}>{formatGhs(tradeShelfPrice(offer.price.exTaxGhs ?? offer.price.ghs, tradePercent))}</p>
        <p className={cn("text-muted-foreground tabular-nums", size === "lg" ? "text-sm" : "text-xs")}>Trade, ex. tax · usual {formatGhs(offer.price.ghs)}</p>
      </div>
    )
  }
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("font-bold tabular-nums", size === "lg" ? "text-3xl" : "text-lg")}>{formatGhs(offer.price.ghs)}</span>
        {offer.price.wasGhs && <span className={cn("text-muted-foreground tabular-nums line-through", size === "lg" ? "text-base" : "text-sm")}>{formatGhs(offer.price.wasGhs)}</span>}
      </p>
      {offer.price.exTaxGhs && <p className={cn("text-muted-foreground tabular-nums", size === "lg" ? "text-sm" : "text-xs")}>{formatGhs(offer.price.exTaxGhs)} ex. tax</p>}
    </div>
  )
}

export function OfferStock({ offer, size = "sm" }: { offer: PricedOffer; size?: "sm" | "lg" }) {
  const stock = stockLine(offer.stock)
  return (
    <p className={cn("flex items-center gap-1.5 font-medium", size === "lg" ? "text-sm" : "text-xs")}>
      <span className={cn("rounded-full", size === "lg" ? "size-2.5" : "size-2", TONE_CLASSES[stock.tone])} aria-hidden />
      {stock.label}
    </p>
  )
}
