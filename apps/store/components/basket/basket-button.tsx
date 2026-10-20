"use client"

import Link from "next/link"
import { ShoppingBasket } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { useBasketCount } from "@/components/basket/basket-count"

export function BasketButton() {
  const count = useBasketCount()

  return (
    <Button render={<Link href="/basket" />} variant="ghost" size="icon" className="relative" aria-label={count ? `Basket, ${count} ${count === 1 ? "item" : "items"}` : "Basket"}>
      <ShoppingBasket className="size-5" aria-hidden />
      {!!count && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] font-semibold text-primary-foreground tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  )
}
