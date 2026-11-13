import { getBrand } from "@/lib/data/brands"
import { categoryHref, getCategoryTree } from "@/lib/data/categories"

// The old bs42.net's product list (/products?category=<slug>, ?brand=<slug>), still in search engines and old links.
// Its category and brand slugs are the catalogue's, so each goes to that category's or brand's page, without the old
// query (robots.txt keeps crawlers off listings with one); anything else goes to the homepage.
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  return permanent(await destination(query.get("category"), query.get("brand")))
}

async function destination(categorySlug: string | null, brandSlug: string | null) {
  if (categorySlug) {
    const tree = await getCategoryTree()
    const node = tree.bySlug.get(categorySlug)
    if (node) return categoryHref(tree, node.id)
  }
  if (brandSlug) {
    const brand = await getBrand(brandSlug)
    if (brand) return `/b/${brand.slug}`
  }
  return "/"
}

// A relative Location, so the redirect stays on whichever host was asked
function permanent(location: string) {
  return new Response(null, { status: 308, headers: { Location: location } })
}
