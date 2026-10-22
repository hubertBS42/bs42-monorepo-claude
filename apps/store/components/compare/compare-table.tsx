"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Package, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"

import { AddToBasketButton } from "@/components/basket/add-to-basket"
import { compareHref, removeComparePick } from "@/components/compare/compare-state"
import { OfferPrice, OfferStock } from "@/components/offer-details"
import { RatingLine } from "@/components/reviews/stars"
import { WishListHeart } from "@/components/wish-list/wish-list-heart"
import { lowestPrice, type CompareRow } from "@/lib/compare"
import type { PricedCard } from "@/lib/product-cards"

// The comparison: a column per product (its price, stock and buttons on top), a row per spec. The row names stay put
// while the table scrolls sideways on narrow screens.
export function CompareTable({ cards, rows }: { cards: PricedCard[]; rows: CompareRow[] }) {
  const router = useRouter()
  const [onlyDifferences, setOnlyDifferences] = useState(false)
  const shownRows = onlyDifferences ? rows.filter((row) => row.differs) : rows

  // Off the page and the bar's list
  const remove = (id: string) => {
    removeComparePick(id)
    router.replace(compareHref(cards.filter((card) => card.id !== id).map((card) => card.id)))
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.length > 0 && (
        <div className="flex items-center gap-2">
          <Switch id="only-differences" checked={onlyDifferences} onCheckedChange={setOnlyDifferences} />
          <Label htmlFor="only-differences">Show only differences</Label>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Products compared</caption>
          <thead>
            <tr>
              <td className="sticky left-0 z-10 w-36 bg-background" />
              {cards.map((card) => {
                const hasVariants = card.options.length > 0
                const offer = card.offers[0]!
                const from = hasVariants ? lowestPrice(card) : null
                return (
                  <th key={card.id} scope="col" className="w-60 max-w-60 min-w-48 px-3 pb-4 text-left align-top font-normal">
                    <div className="flex h-full flex-col gap-2">
                      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {card.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
                          <img src={card.image} alt="" className="size-full object-contain p-3" />
                        ) : (
                          <Package className="size-12 text-muted-foreground/40" aria-hidden />
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="absolute top-2 right-2 rounded-full bg-background/80 backdrop-blur"
                          onClick={() => remove(card.id)}
                          aria-label={`Remove ${card.name} from the comparison`}
                        >
                          <X aria-hidden />
                        </Button>
                      </div>
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{card.brand.name}</p>
                      <Link href={`/p/${card.slug}`} className="line-clamp-2 leading-snug font-semibold hover:underline hover:underline-offset-4">
                        {card.name}
                      </Link>
                      {card.numReviews > 0 && <RatingLine rating={card.rating} count={card.numReviews} className="text-xs" />}
                      {hasVariants ? (
                        <>
                          {from?.price ? (
                            <div>
                              <p className="text-xs text-muted-foreground">From</p>
                              <OfferPrice offer={from} />
                            </div>
                          ) : (
                            <OfferPrice offer={offer} />
                          )}
                          <Button render={<Link href={`/p/${card.slug}`} />} variant="outline" size="sm" className="mt-auto w-full">
                            Choose options
                          </Button>
                        </>
                      ) : (
                        <>
                          <OfferPrice offer={offer} />
                          <OfferStock offer={offer} />
                          <div className="mt-auto flex items-center gap-2">
                            <AddToBasketButton offer={offer} label={card.name} size="sm" className="flex-1" />
                            <WishListHeart item={{ productId: card.id, variantId: null }} label={card.name} />
                          </div>
                        </>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {shownRows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="sticky left-0 z-10 w-36 border-t bg-background py-2.5 pr-3 text-left align-top font-medium text-muted-foreground">
                  {row.name}
                </th>
                {row.values.map((value, index) => (
                  <td key={cards[index]!.id} className={cn("border-t px-3 py-2.5 align-top", row.differs && "font-medium")}>
                    {value ?? <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
            {onlyDifferences && shownRows.length === 0 && (
              <tr>
                <td colSpan={cards.length + 1} className="border-t py-6 text-center text-muted-foreground">
                  These products don&apos;t differ in any of their specs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
