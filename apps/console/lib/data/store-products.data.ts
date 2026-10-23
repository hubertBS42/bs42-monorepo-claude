import "server-only"

import { headers } from "next/headers"
import { consoleAuth } from "@workspace/auth/console"
import { formatError } from "@workspace/auth/format-error"
import { describeVariant } from "@workspace/commerce/order-writes"
import { installationFee, loadCategoryFees } from "@workspace/commerce/installation"
import type { DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { SpecType, Status } from "@workspace/db/enums"
import { getStoreRole } from "@/lib/auth-guard"
import { getCategoryPaths } from "@/lib/data/products.data"
import type { StoreProductDetails } from "@/types"

const NOT_FOUND = { success: false as const, error: "Product not found.", code: "NOT_FOUND" }

// A decimal without trailing zeros: 12.5000 → "12.5"
const plainNumber = (value: Prisma.Decimal) => value.toDecimalPlaces(4).toString()

function specValueText(value: {
  spec: { type: SpecType; unit: string | null }
  option: { value: string } | null
  numberValue: Prisma.Decimal | null
  booleanValue: boolean | null
  textValue: string | null
}) {
  switch (value.spec.type) {
    case SpecType.SELECT:
      return value.option?.value ?? null
    case SpecType.NUMBER:
      return value.numberValue ? [plainNumber(value.numberValue), value.spec.unit].filter(Boolean).join(" ") : null
    case SpecType.BOOLEAN:
      return value.booleanValue === null ? null : value.booleanValue ? "Yes" : "No"
    case SpecType.TEXT:
      return value.textValue
  }
}

// A catalogue product as a store's staff see it, read-only: any published product (one they could list), or one
// their store lists whatever its status. The catalogue's own pages are for system admins only.
export const getStoreProductDetails = async (storeId: string, productId: string): Promise<DataResponse<StoreProductDetails>> => {
  try {
    const session = await consoleAuth.api.getSession({ headers: await headers() })
    if (!session) return { success: false, error: "Unauthorized" }
    if (!(await getStoreRole(session.user.id, storeId))) return { success: false, error: "Forbidden" }

    const product = await prisma.product.findFirst({
      where: { id: productId, OR: [{ status: Status.PUBLISHED }, { storeListings: { some: { organizationId: storeId } } }] },
      include: {
        brand: { select: { name: true } },
        documents: { select: { id: true, name: true, url: true }, orderBy: { createdAt: "asc" } },
        variants: {
          where: { status: { not: Status.ARCHIVED } },
          orderBy: [{ position: "asc" }, { id: "asc" }],
          select: {
            id: true,
            sku: true,
            barcode: true,
            weight: true,
            dimensions: true,
            status: true,
            variantValues: { select: { optionValue: { select: { value: true, option: { select: { name: true, position: true } } } } } },
          },
        },
        specValues: {
          select: {
            spec: { select: { name: true, type: true, unit: true, position: true, categoryId: true } },
            option: { select: { value: true } },
            numberValue: true,
            booleanValue: true,
            textValue: true,
          },
        },
        storeListings: { where: { organizationId: storeId }, select: { id: true } },
      },
    })
    if (!product) return NOT_FOUND

    const [categories, categoryFees] = await Promise.all([prisma.category.findMany({ select: { id: true, name: true, parentId: true } }), loadCategoryFees(prisma)])
    const fee = installationFee(product, categoryFees)

    // Specs in the order the storefront shows them: the top category's first, then each category's by position
    const depth = new Map<string, number>()
    for (let id: string | null | undefined = product.categoryId, level = 0; id && level < 50; level++) {
      depth.set(id, level)
      id = categories.find((category) => category.id === id)?.parentId
    }
    const specs = product.specValues
      .filter((value) => depth.has(value.spec.categoryId))
      .sort((a, b) => depth.get(b.spec.categoryId)! - depth.get(a.spec.categoryId)! || a.spec.position - b.spec.position || a.spec.name.localeCompare(b.spec.name))
      .map((value) => ({ name: value.spec.name, value: specValueText(value) }))
      .filter((spec): spec is { name: string; value: string } => spec.value !== null)

    return {
      success: true,
      data: {
        id: product.id,
        name: product.name,
        brandName: product.brand.name,
        categoryPath: getCategoryPaths(categories).get(product.categoryId) ?? "",
        status: product.status,
        condition: product.condition,
        description: product.description,
        images: product.images ?? [],
        baseSellPrice: product.baseSellPrice.toFixed(2),
        baseBuyPrice: product.baseBuyPrice.toFixed(2),
        sku: product.sku,
        barcode: product.barcode,
        weight: product.weight ? plainNumber(product.weight) : null,
        dimensions: product.dimensions,
        hasVariants: product.hasVariants,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          label: describeVariant(variant.variantValues) ?? variant.sku,
          sku: variant.sku,
          barcode: variant.barcode,
          weight: variant.weight ? plainNumber(variant.weight) : null,
          dimensions: variant.dimensions,
          status: variant.status,
        })),
        specs,
        documents: product.documents,
        installationFeeGhs: fee ? fee.toFixed(2) : null,
        listingId: product.storeListings[0]?.id ?? null,
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
