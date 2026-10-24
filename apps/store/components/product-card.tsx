"use client"

import Link from "next/link"
import { Package } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

import { AddToBasketButton } from "@/components/basket/add-to-basket"
import { CompareToggle } from "@/components/compare/compare-toggle"
import { OfferPrice, OfferStock } from "@/components/offer-details"
import { RatingLine } from "@/components/reviews/stars"
import { useOfferPicker } from "@/components/use-offer-picker"
import { WishListHeart } from "@/components/wish-list/wish-list-heart"
import { CONDITION_LABELS } from "@/lib/conditions"
import { isInStock, type PricedCard } from "@/lib/product-cards"

// A card shows this many of an option's values; the product page has the rest
const MAX_VALUES = 6

// The specs a card lists: up to three values, with a yes/no spec by its name when it's yes
function keySpecs(card: PricedCard) {
  return card.specs
    .flatMap((spec) => (spec.type === "BOOLEAN" ? (spec.key === "yes" ? [spec.name] : []) : [spec.label]))
    .slice(0, 3)
    .join(" · ")
}

// `variantId` opens the card on that variant's offer (the wish list's saved one); `onWishListChange` runs after its heart
// changes the list
export function ProductCard({ card, variantId, onWishListChange }: { card: PricedCard; variantId?: string | null; onWishListChange?: () => void }) {
  const { offer, options } = useOfferPicker(card, variantId)

  const href = `/p/${card.slug}${offer.variantId ? `?variant=${offer.variantId}` : ""}`
  const specs = keySpecs(card)
  const image = offer.image ?? card.image
  const values = options.flatMap((option) => option.values.filter((value) => value.selected).map((value) => value.value))
  const label = values.length ? `${card.name} (${values.join(", ")})` : card.name

  return (
    <article className="group relative flex h-full flex-col gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-md">
      {/* Product photos are shot on white, so a tile with one is white in both themes: grey would frame the photo */}
      <div className={cn("relative flex aspect-square items-center justify-center overflow-hidden rounded-lg", image ? "bg-white" : "bg-muted")}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
          <img src={image} alt="" className="size-full object-contain p-1 transition-transform group-hover:scale-105" />
        ) : (
          <Package className="size-14 text-muted-foreground/40" aria-hidden />
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {offer.price?.wasGhs && <Badge variant="destructive">Sale</Badge>}
          {card.condition !== "NEW" && <Badge variant="secondary">{CONDITION_LABELS[card.condition]}</Badge>}
        </div>
        <WishListHeart item={{ productId: card.id, variantId: offer.variantId }} label={label} onChange={onWishListChange} className="absolute top-2 right-2 z-10" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{card.brand.name}</p>
        <h3 className="line-clamp-2 leading-snug font-semibold">
          <Link href={href} className="after:absolute after:inset-0">
            {card.name}
          </Link>
        </h3>
        {card.numReviews > 0 && <RatingLine rating={card.rating} count={card.numReviews} className="text-xs" />}
        {specs && <p className="line-clamp-1 text-xs text-muted-foreground">{specs}</p>}

        {options.map((option) => (
          <div key={option.name} className="relative z-10 flex flex-wrap items-center gap-1" role="group" aria-label={option.name}>
            {option.values.slice(0, MAX_VALUES).map((value) => (
              <button
                key={value.id}
                type="button"
                onClick={value.pick}
                aria-pressed={value.selected}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs transition-colors hover:border-foreground/40",
                  value.selected && "border-foreground bg-foreground text-background hover:border-foreground",
                  !value.available && "border-dashed text-muted-foreground"
                )}
              >
                {value.value}
              </button>
            ))}
            {option.values.length > MAX_VALUES && <span className="text-xs text-muted-foreground">+{option.values.length - MAX_VALUES} more</span>}
          </div>
        ))}

        <div className="mt-auto space-y-1.5 pt-2">
          <div className="flex items-end justify-between gap-2">
            <OfferPrice offer={offer} />
            {offer.price && isInStock(offer) && <AddToBasketButton offer={offer} label={label} iconOnly className="relative z-10 shrink-0" />}
          </div>
          <OfferStock offer={offer} />
          <CompareToggle pick={{ id: card.id, name: card.name, slug: card.slug, image: card.image, categoryId: card.categoryId }} onHover className="relative z-10" />
        </div>
      </div>
    </article>
  )
}
