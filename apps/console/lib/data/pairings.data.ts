import "server-only"

import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { getCategoryChain } from "@/lib/product-specs"
import type { PairingItem, PairingOwner, PairingsData } from "@/types"

// At most this many products on one list: the storefront shows them in a row or two
export const MAX_PAIRINGS = 8

const pairingSelect = {
  id: true,
  pairedProduct: { select: { id: true, name: true, images: true, status: true, brand: { select: { name: true } } } },
} satisfies Prisma.ProductPairingSelect

type PairingRow = Prisma.ProductPairingGetPayload<{ select: typeof pairingSelect }>

const toItem = ({ id, pairedProduct: product }: PairingRow): PairingItem => ({
  id,
  productId: product.id,
  name: product.name,
  brandName: product.brand.name,
  image: product.images[0] ?? null,
  status: product.status,
})

export const ownerWhere = (owner: PairingOwner) => (owner.kind === "category" ? { categoryId: owner.id } : { productId: owner.id })

// A category's or a product's list, in order. Pages call their own guard first.
export async function getPairings(owner: PairingOwner): Promise<PairingsData> {
  const rows = await prisma.productPairing.findMany({ where: ownerWhere(owner), orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: pairingSelect })
  if (owner.kind === "category" || rows.length) return { items: rows.map(toItem), inherited: null }

  // A product with none of its own: the nearest category up the tree with a list
  const product = await prisma.product.findUnique({ where: { id: owner.id }, select: { categoryId: true } })
  if (!product) return { items: [], inherited: null }
  const categories = await prisma.category.findMany({ select: { id: true, parentId: true, name: true } })
  const inheritedRows = await prisma.productPairing.findMany({
    where: { categoryId: { in: getCategoryChain(categories, product.categoryId) } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { ...pairingSelect, categoryId: true },
  })
  for (const categoryId of getCategoryChain(categories, product.categoryId)) {
    const items = inheritedRows.filter((row) => row.categoryId === categoryId && row.pairedProduct.id !== owner.id)
    if (items.length) return { items: [], inherited: { categoryName: categories.find((category) => category.id === categoryId)!.name, items: items.map(toItem) } }
  }
  return { items: [], inherited: null }
}
