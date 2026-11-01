import { ProductCard } from "@/components/product-card"
import type { PricedCard } from "@/lib/product-cards"

// A titled row of product cards under the product page's details: "Pairs well with", "You may also like"
export function ProductShelf({ id, title, cards }: { id: string; title: string; cards: PricedCard[] }) {
  if (!cards.length) return null
  return (
    <section aria-labelledby={`${id}-heading`} className="mt-12 border-t pt-8">
      <h2 id={`${id}-heading`} className="mb-6 text-xl font-bold tracking-tight">
        {title}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <li key={card.id}>
            <ProductCard card={card} />
          </li>
        ))}
      </ul>
    </section>
  )
}
