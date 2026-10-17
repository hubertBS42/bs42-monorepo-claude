/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */
import Link from "next/link"
import { Search } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { formatCurrency } from "@workspace/utils/currency"
import type { ListableProduct } from "@/types"

interface ProductPickerProps {
  products: ListableProduct[]
  // How many products match; `products` holds the first of them
  total: number
  search?: string
  // The limit for "Show more", or null when everything is shown or the most has been reached
  nextLimit: number | null
}

// A plain GET form and links, so it needs no client code: the server filters, since the catalogue can be large
const ProductPicker = ({ products, total, search, nextLimit }: ProductPickerProps) => {
  const shown = products.length
  const moreHref = nextLimit && `/store/listings/add?${new URLSearchParams({ ...(search && { search }), limit: String(nextLimit) })}`

  return (
    <div className="grid gap-6">
      <form method="get" className="flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input name="search" type="search" defaultValue={search} placeholder="Search by name, SKU or brand" aria-label="Search products" className="pl-9" />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {total === 0
          ? search
            ? "No products match your search."
            : "Every published product is already listed in this store."
          : total > shown
            ? `Showing ${shown} of ${total} products.${nextLimit ? "" : " Search to narrow them down."}`
            : `${total} product${total === 1 ? "" : "s"}.`}
        {total > 0 && " Products this store already lists aren't shown."}
      </p>

      {products.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {products.map((product) => (
            <Link key={product.id} href={`/store/listings/add?productId=${product.id}`} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <Card className="h-full gap-3 overflow-hidden p-0 transition-colors hover:bg-accent/50">
                <div className="relative aspect-square bg-muted">
                  {product.image ? (
                    <img src={product.image} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>
                  )}
                  {product.hasVariants && (
                    <Badge variant="outline" className="absolute top-2 left-2 bg-background/80">
                      Variants
                    </Badge>
                  )}
                </div>
                <CardContent className="grid gap-1 px-3 pb-3">
                  <p className="truncate leading-tight font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.brandName}</p>
                  <p className="text-sm">{formatCurrency(product.baseSellPrice)}</p>
                  <p className="truncate text-xs text-muted-foreground">{product.categoryPath}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {moreHref && (
        <Link href={moreHref} scroll={false} className={buttonVariants({ variant: "outline", className: "justify-self-center" })}>
          Show more
        </Link>
      )}
    </div>
  )
}

export default ProductPicker
