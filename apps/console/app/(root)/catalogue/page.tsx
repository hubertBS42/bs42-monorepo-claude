import { Card, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ShoppingBag, Tag, Building2, ArrowRightIcon, Star, PackagePlus } from "lucide-react"
import Link from "next/link"
import type { Metadata } from "next"
import { requireConsoleAdmin } from "@/lib/auth-guard"

export const metadata: Metadata = { title: "Catalogue" }

const catalogueLinks = [
  {
    href: "/catalogue/products",
    icon: ShoppingBag,
    title: "Products",
    description: "Manage the products to be listed in stores",
  },
  {
    href: "/catalogue/categories",
    icon: Tag,
    title: "Categories",
    description: "Manage the categories associated with your products",
  },
  {
    href: "/catalogue/brands",
    icon: Building2,
    title: "Brands",
    description: "Manage the brands associated with your products",
  },
  {
    href: "/catalogue/reviews",
    icon: Star,
    title: "Reviews",
    description: "Read customers' product reviews and hide those that break the rules",
  },
  {
    href: "/catalogue/product-requests",
    icon: PackagePlus,
    title: "Product Requests",
    description: "Add the products stores ask for, or tell them why not",
  },
]

const CataloguePage = async () => {
  await requireConsoleAdmin()

  return (
    <main className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Catalogue</h1>
        <p className="text-sm text-muted-foreground">Manage your products, categories and brands, their reviews, and the products stores ask for.</p>
      </div>

      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {catalogueLinks.map((link) => {
          const Icon = link.icon
          return (
            // The title link stretches over the whole card, so the card is one click target with one accessible name
            <Card key={link.href} className="relative transition-colors hover:bg-accent/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <CardTitle className="text-base">
                  <Link href={link.href} className="after:absolute after:inset-0">
                    {link.title}
                  </Link>
                </CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </main>
  )
}

export default CataloguePage
