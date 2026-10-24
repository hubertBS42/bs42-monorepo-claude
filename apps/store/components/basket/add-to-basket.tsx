"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { ShoppingBasket } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { setBasketCount } from "@/components/basket/basket-count"
import { addToBasketAction } from "@/lib/actions/cart.actions"
import { isInStock, type PricedOffer } from "@/lib/product-cards"

// Adds an offer to the basket. Only offers with stock and a price can be bought: an order reserves stock, so there are
// no back orders. `label` names the item in the toast. `iconOnly` is the product card's: the basket icon alone, with
// its words as the label.
export function AddToBasketButton({
  offer,
  label,
  quantity = 1,
  installation = false,
  onAdded,
  size = "default",
  iconOnly = false,
  className,
}: {
  offer: PricedOffer
  label: string
  quantity?: number
  // Ticked on the product page: the basket line includes installation
  installation?: boolean
  onAdded?: () => void
  size?: "default" | "sm" | "lg"
  iconOnly?: boolean
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const canBuy = !!offer.price && isInStock(offer)

  const add = () =>
    startTransition(async () => {
      const result = await addToBasketAction({ listingId: offer.listingId, listingVariantId: offer.listingVariantId, quantity, installation })
      if (!result.success) {
        toast.add({ title: "Couldn't add that to your basket", description: result.error, type: "error" })
        return
      }

      const { added, quantity: inBasket, capped, count } = result.data
      setBasketCount(count)
      onAdded?.()
      const viewBasket = { children: "View basket", onClick: () => router.push("/basket") }
      if (added === 0) {
        toast.add({ title: "That's all we have", description: `Your basket already holds the last ${inBasket} of ${label}.`, type: "warning", actionProps: viewBasket })
      } else if (capped) {
        toast.add({ title: `Added ${added} to your basket`, description: `That's all we have of ${label}: your basket now holds ${inBasket}.`, type: "warning", actionProps: viewBasket })
      } else {
        const description = `${added > 1 ? `${added} × ${label}` : label}${installation ? ", with installation" : ""}`
        toast.add({ title: "Added to your basket", description, type: "success", actionProps: viewBasket })
      }
    })

  const words = canBuy ? "Add to basket" : offer.price ? "Out of stock" : "Not available yet"
  if (iconOnly) {
    return (
      <Button type="button" size="icon" className={className} onClick={add} disabled={!canBuy || isPending} aria-label={`${words}: ${label}`} title={words}>
        {isPending ? <Spinner /> : <ShoppingBasket aria-hidden />}
      </Button>
    )
  }
  return (
    <Button type="button" size={size} className={className} onClick={add} disabled={!canBuy || isPending}>
      {isPending ? <Spinner data-icon="inline-start" /> : <ShoppingBasket data-icon="inline-start" aria-hidden />}
      {words}
    </Button>
  )
}
