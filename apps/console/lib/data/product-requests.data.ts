import "server-only"

import { headers } from "next/headers"
import { consoleAuth } from "@workspace/auth/console"
import { formatError } from "@workspace/auth/format-error"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import type { DataResponse, PaginatedResult } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { ProductRequestStatus, Status } from "@workspace/db/enums"
import { getStoreRole } from "@/lib/auth-guard"
import { getCategoryPaths } from "@/lib/data/products.data"
import type { CatalogueMatch, CatalogueProductOption, ProductRequestDetails, ProductRequestListItem, ProductRequestsParams } from "@/types"

export const MAX_PRODUCT_REQUESTS_PAGE_SIZE = 100

const NOT_FOUND = { success: false as const, error: "Request not found.", code: "NOT_FOUND" }

const listSelect = {
  id: true,
  name: true,
  brandName: true,
  status: true,
  declineReason: true,
  createdAt: true,
  brand: { select: { name: true } },
  organization: { select: { name: true } },
  requestedBy: { select: { name: true } },
  product: { select: { id: true, name: true } },
} satisfies Prisma.ProductRequestSelect

function toListItem(row: Prisma.ProductRequestGetPayload<{ select: typeof listSelect }>): ProductRequestListItem {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand?.name ?? row.brandName,
    newBrand: !row.brand && !!row.brandName,
    storeName: row.organization.name,
    requestedBy: row.requestedBy?.name ?? null,
    status: row.status,
    product: row.product,
    declineReason: row.declineReason,
    createdAt: row.createdAt,
  }
}

async function getSession() {
  return consoleAuth.api.getSession({ headers: await headers() })
}

// Pending first (oldest first, the queue), then the rest newest first
async function listRequests(where: Prisma.ProductRequestWhereInput, page: number, pageSize: number): Promise<PaginatedResult<ProductRequestListItem>> {
  const [pending, others, total] = await Promise.all([
    prisma.productRequest.count({ where: { ...where, status: ProductRequestStatus.PENDING } }),
    prisma.productRequest.count({ where: { ...where, status: { not: ProductRequestStatus.PENDING } } }),
    prisma.productRequest.count({ where }),
  ])
  // Two queries stitched into one page: Prisma can't order by "is pending" first
  const start = (page - 1) * pageSize
  const pendingRows =
    start < pending
      ? await prisma.productRequest.findMany({
          where: { ...where, status: ProductRequestStatus.PENDING },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          skip: start,
          take: pageSize,
          select: listSelect,
        })
      : []
  const otherRows =
    pendingRows.length < pageSize && others > 0
      ? await prisma.productRequest.findMany({
          where: { ...where, status: { not: ProductRequestStatus.PENDING } },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: Math.max(0, start - pending),
          take: pageSize - pendingRows.length,
          select: listSelect,
        })
      : []
  return { data: [...pendingRows, ...otherRows].map(toListItem), total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

// The store's own requests
export const getStoreProductRequests = async (storeId: string, { status, page = 1, pageSize = 10 }: ProductRequestsParams): Promise<DataResponse<PaginatedResult<ProductRequestListItem>>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (!(await getStoreRole(session.user.id, storeId))) return { success: false, error: "Forbidden" }
    if (pageSize > MAX_PRODUCT_REQUESTS_PAGE_SIZE) return { success: false, error: "Page size too large" }

    return { success: true, data: await listRequests({ organizationId: storeId, ...(status && { status }) }, page, pageSize) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Every store's, for platform admins
export const getProductRequests = async ({ status, storeId, page = 1, pageSize = 10 }: ProductRequestsParams): Promise<DataResponse<PaginatedResult<ProductRequestListItem>>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (!hasSystemRole(session.user.role, consoleAdminRoles)) return { success: false, error: "Forbidden" }
    if (pageSize > MAX_PRODUCT_REQUESTS_PAGE_SIZE) return { success: false, error: "Page size too large" }

    return { success: true, data: await listRequests({ ...(status && { status }), ...(storeId && { organizationId: storeId }) }, page, pageSize) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export const getProductRequestDetails = async (requestId: string): Promise<DataResponse<ProductRequestDetails>> => {
  try {
    const session = await getSession()
    if (!session) return { success: false, error: "Unauthorized" }
    if (!hasSystemRole(session.user.role, consoleAdminRoles)) return { success: false, error: "Forbidden" }

    const row = await prisma.productRequest.findUnique({
      where: { id: requestId },
      select: {
        ...listSelect,
        organizationId: true,
        brandId: true,
        categoryId: true,
        barcode: true,
        link: true,
        notes: true,
        reviewedAt: true,
        requestedBy: { select: { name: true, email: true } },
        reviewedBy: { select: { name: true } },
      },
    })
    if (!row) return NOT_FOUND

    const categories = row.categoryId ? await prisma.category.findMany({ select: { id: true, name: true, parentId: true } }) : []
    return {
      success: true,
      data: {
        ...toListItem(row),
        storeId: row.organizationId,
        requestedByEmail: row.requestedBy?.email ?? null,
        brandId: row.brandId,
        categoryPath: row.categoryId ? (getCategoryPaths(categories).get(row.categoryId) ?? null) : null,
        barcode: row.barcode,
        link: row.link,
        notes: row.notes,
        reviewedBy: row.reviewedBy?.name ?? null,
        reviewedAt: row.reviewedAt,
      },
    }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// A pending request, as the add product form starts from it: the category only when products can go in it (a leaf,
// not archived), and the brand only when it isn't archived
export const getProductRequestForProductForm = async (requestId: string) => {
  const row = await prisma.productRequest.findFirst({
    where: { id: requestId, status: ProductRequestStatus.PENDING },
    select: {
      id: true,
      name: true,
      brandName: true,
      barcode: true,
      link: true,
      notes: true,
      organization: { select: { name: true } },
      brand: { select: { id: true, name: true, status: true } },
      category: { select: { id: true, name: true, status: true, _count: { select: { childCategories: true } } } },
    },
  })
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    brandId: row.brand && row.brand.status !== Status.ARCHIVED ? row.brand.id : "",
    brandName: row.brand?.name ?? row.brandName,
    categoryId: row.category && row.category.status !== Status.ARCHIVED && row.category._count.childCategories === 0 ? row.category.id : "",
    categoryName: row.category?.name ?? null,
    barcode: row.barcode,
    link: row.link,
    notes: row.notes,
    storeName: row.organization.name,
  }
}

export type ProductRequestForForm = NonNullable<Awaited<ReturnType<typeof getProductRequestForProductForm>>>

export const countPendingProductRequests = () => prisma.productRequest.count({ where: { status: ProductRequestStatus.PENDING } })

// The words of a name, each to be found in a product's name
const nameWords = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .slice(0, 6)

const MATCHES_SHOWN = 5

// Published products (the ones a store can list) the store may mean: the same barcode or SKU, or every word of the name
export async function findCatalogueMatches(storeId: string, name: string, barcode: string): Promise<CatalogueMatch[]> {
  const words = nameWords(name)
  const code = barcode.length >= 3 ? { equals: barcode, mode: "insensitive" as const } : null
  const or: Prisma.ProductWhereInput[] = [
    ...(code ? [{ barcode: code }, { sku: code }, { variants: { some: { OR: [{ barcode: code }, { sku: code }] } } }] : []),
    ...(name.trim().length >= 3 && words.length ? [{ AND: words.map((word) => ({ name: { contains: word, mode: "insensitive" as const } })) }] : []),
  ]
  if (or.length === 0) return []

  const products = await prisma.product.findMany({
    where: { status: Status.PUBLISHED, OR: or },
    orderBy: { name: "asc" },
    take: MATCHES_SHOWN,
    select: { id: true, name: true, images: true, brand: { select: { name: true } }, storeListings: { where: { organizationId: storeId }, select: { id: true } } },
  })
  return products.map((product) => ({ id: product.id, name: product.name, brandName: product.brand.name, image: product.images?.[0] ?? null, listingId: product.storeListings[0]?.id ?? null }))
}

const SEARCH_RESULTS = 10

// Any catalogue product by name, SKU or barcode, for an admin linking a request to it
export async function searchCatalogueProducts(search: string): Promise<CatalogueProductOption[]> {
  const contains = { contains: search, mode: "insensitive" as const }
  const products = await prisma.product.findMany({
    where: { OR: [{ name: contains }, { sku: contains }, { barcode: contains }, { variants: { some: { OR: [{ sku: contains }, { barcode: contains }] } } }] },
    orderBy: { name: "asc" },
    take: SEARCH_RESULTS,
    select: { id: true, name: true, status: true, brand: { select: { name: true } } },
  })
  return products.map((product) => ({ id: product.id, name: product.name, brandName: product.brand.name, status: product.status }))
}
