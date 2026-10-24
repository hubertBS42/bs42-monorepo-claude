import Link from "next/link"
import { ArrowRight, LayoutGrid } from "lucide-react"

export interface CategoryTile {
  id: string
  name: string
  image: string | null
  href: string
  productCount: number
  children: { id: string; name: string; href: string }[]
}

// The homepage's "Shop by category": a card per top-level category, its image across the top (the category form's
// image, the one the carousel shows), and its subcategories as links. The whole card opens the category.
export function CategoryGrid({ tiles }: { tiles: CategoryTile[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile) => (
        <li key={tile.id} className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
          <div className="aspect-[2/1] overflow-hidden bg-muted">
            {tile.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
              <img src={tile.image} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/15 to-primary/5">
                <LayoutGrid className="size-10 text-primary/40" aria-hidden />
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-5">
            <Link href={tile.href} className="flex items-center justify-between gap-2 font-semibold after:absolute after:inset-0">
              <span className="text-lg">{tile.name}</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <p className="text-sm text-muted-foreground">
              {tile.productCount} {tile.productCount === 1 ? "product" : "products"}
            </p>
            {tile.children.length > 0 && (
              <ul className="relative z-10 mt-3 flex flex-wrap gap-1.5">
                {tile.children.map((child) => (
                  <li key={child.id}>
                    <Link href={child.href} className="inline-flex rounded-full bg-muted px-3 py-1 text-sm hover:bg-accent">
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
