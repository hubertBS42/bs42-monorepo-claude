"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Package, Trash2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { ProductCard } from "@/components/product-card"
import { useWishListToggle } from "@/components/wish-list/wish-list-heart"
import type { PricedCard } from "@/lib/product-cards"
import type { WishListEntry } from "@/lib/wish-list"

// A saved item: its card while it's on sale, else what it was, to remove it, and whether the product's other options
// are on sale
export type WishListGridItem = { entry: WishListEntry } & ({ card: PricedCard } | { card: null; otherOptionsOnSale: boolean })

function UnavailableItem({ entry, otherOptionsOnSale, onRemoved }: { entry: WishListEntry; otherOptionsOnSale: boolean; onRemoved: () => void }) {
  const label = entry.variantLabel ? `${entry.name} (${entry.variantLabel})` : entry.name
  const { isPending, toggle } = useWishListToggle({ productId: entry.productId, variantId: entry.variantId }, label, onRemoved)

  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border bg-card p-3">
      <div className={cn("flex aspect-square items-center justify-center overflow-hidden rounded-lg", entry.image ? "bg-white" : "bg-muted")}>
        {entry.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
          <img src={entry.image} alt="" className="size-full object-contain p-1 opacity-50 grayscale" />
        ) : (
          <Package className="size-14 text-muted-foreground/40" aria-hidden />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{entry.brandName}</p>
        <h3 className="line-clamp-2 leading-snug font-semibold">{entry.name}</h3>
        {entry.variantLabel && <p className="text-xs text-muted-foreground">{entry.variantLabel}</p>}
        <p className="text-sm text-muted-foreground">{otherOptionsOnSale ? "This option isn't available right now." : "Not available right now."}</p>
        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          {otherOptionsOnSale && (
            <Button render={<Link href={`/p/${entry.slug}`} />} variant="outline" size="sm">
              See other options
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={toggle} disabled={isPending}>
            <Trash2 data-icon="inline-start" aria-hidden />
            Remove
          </Button>
        </div>
      </div>
    </article>
  )
}

// The wish list page's items. The page reloads after a change, so a removed item leaves it.
export function WishListGrid({ items }: { items: WishListGridItem[] }) {
  const router = useRouter()
  const reload = () => router.refresh()

  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.entry.id}>
          {item.card ? (
            <ProductCard card={item.card} variantId={item.entry.variantId} onWishListChange={reload} />
          ) : (
            <UnavailableItem entry={item.entry} otherOptionsOnSale={item.otherOptionsOnSale} onRemoved={reload} />
          )}
        </li>
      ))}
    </ul>
  )
}
