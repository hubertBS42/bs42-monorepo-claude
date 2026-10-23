"use server"

import { after } from "next/server"
import { z } from "zod"
import { formatError } from "@workspace/auth/format-error"
import { notifyProductRequest, notifyProductRequestDecision } from "@workspace/commerce/notifications"
import type { ActionResponse, DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { ProductRequestStatus, Status } from "@workspace/db/enums"
import { hasStorePermission, requireConsoleAccess, requireSystemPermission } from "@/lib/auth-guard"
import { findCatalogueMatches, searchCatalogueProducts } from "@/lib/data/product-requests.data"
import type { CatalogueMatch, CatalogueProductOption } from "@/types"
import {
  cancelProductRequestSchema,
  createProductRequestSchema,
  declineProductRequestSchema,
  findCatalogueMatchesSchema,
  matchProductRequestSchema,
  searchCatalogueSchema,
} from "@/lib/schemas/product-request.schemas"

// Every export here is a public endpoint, so every input is validated. A store's side needs the store permission to
// add listings (every store role has it): whoever lists products can ask for one. The platform's side is the
// catalogue's (system permission product: update).

// Refusals, which fit both ActionResponse and DataResponse
type Refusal = { success: false; error: string; code: string }

function invalidInput(error: z.ZodError): Refusal {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const NOT_ALLOWED: Refusal = { success: false, error: "Your role in this store can't request products.", code: "FORBIDDEN" }
const NOT_PENDING: Refusal = { success: false, error: "This request has been dealt with since the page loaded.", code: "NOT_PENDING" }

export async function createProductRequestAction(input: z.input<typeof createProductRequestSchema>): Promise<DataResponse<{ id: string }>> {
  const { user } = await requireConsoleAccess()

  try {
    const parsed = createProductRequestSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, brandId, brandName, categoryId, ...fields } = parsed.data
    if (!(await hasStorePermission(user.id, storeId, { listing: ["create"] }))) return NOT_ALLOWED

    // A brand or category archived or deleted since the page loaded is dropped: the name still says what's wanted
    const [brand, category] = await Promise.all([
      brandId ? prisma.brand.findFirst({ where: { id: brandId, status: { not: Status.ARCHIVED } }, select: { id: true } }) : null,
      categoryId ? prisma.category.findFirst({ where: { id: categoryId, status: { not: Status.ARCHIVED } }, select: { id: true } }) : null,
    ])

    const request = await prisma.productRequest.create({
      data: { ...fields, organizationId: storeId, requestedById: user.id, brandId: brand?.id ?? null, brandName: brand ? null : brandName, categoryId: category?.id ?? null },
      select: { id: true },
    })
    after(() => notifyProductRequest(request.id))
    return { success: true, data: request }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Withdrawn by the store while it's still pending
export async function cancelProductRequestAction(input: z.input<typeof cancelProductRequestSchema>): Promise<ActionResponse> {
  const { user } = await requireConsoleAccess()

  try {
    const parsed = cancelProductRequestSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, requestId } = parsed.data
    if (!(await hasStorePermission(user.id, storeId, { listing: ["create"] }))) return NOT_ALLOWED

    const { count } = await prisma.productRequest.updateMany({
      where: { id: requestId, organizationId: storeId, status: ProductRequestStatus.PENDING },
      data: { status: ProductRequestStatus.CANCELLED },
    })
    return count ? { success: true } : NOT_PENDING
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Catalogue products the store may mean, while it types: the store can list one instead of asking
export async function findCatalogueMatchesAction(input: z.input<typeof findCatalogueMatchesSchema>): Promise<DataResponse<CatalogueMatch[]>> {
  const { user } = await requireConsoleAccess()

  try {
    const parsed = findCatalogueMatchesSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    const { storeId, name, barcode } = parsed.data
    if (!(await hasStorePermission(user.id, storeId, { listing: ["create"] }))) return { success: false, error: "Forbidden" }

    return { success: true, data: await findCatalogueMatches(storeId, name, barcode) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function declineProductRequestAction(input: z.input<typeof declineProductRequestSchema>): Promise<ActionResponse> {
  const { user } = await requireSystemPermission({ product: ["update"] })

  try {
    const parsed = declineProductRequestSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { requestId, reason } = parsed.data

    const { count } = await prisma.productRequest.updateMany({
      where: { id: requestId, status: ProductRequestStatus.PENDING },
      data: { status: ProductRequestStatus.DECLINED, declineReason: reason, reviewedById: user.id, reviewedAt: new Date() },
    })
    if (!count) return NOT_PENDING
    after(() => notifyProductRequestDecision(requestId))
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// The product was already in the catalogue: the store is told which, to list it
export async function matchProductRequestAction(input: z.input<typeof matchProductRequestSchema>): Promise<ActionResponse> {
  const { user } = await requireSystemPermission({ product: ["update"] })

  try {
    const parsed = matchProductRequestSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { requestId, productId } = parsed.data

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { status: true } })
    if (!product) return { success: false, error: "That product no longer exists.", code: "PRODUCT_NOT_FOUND" }

    const { count } = await prisma.productRequest.updateMany({
      where: { id: requestId, status: ProductRequestStatus.PENDING },
      data: { status: ProductRequestStatus.MATCHED, productId, reviewedById: user.id, reviewedAt: new Date() },
    })
    if (!count) return NOT_PENDING
    after(() => notifyProductRequestDecision(requestId))
    return { success: true }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

// Any catalogue product, by name, SKU or barcode, for linking a request to one
export async function searchCatalogueProductsAction(input: z.input<typeof searchCatalogueSchema>): Promise<DataResponse<CatalogueProductOption[]>> {
  await requireSystemPermission({ product: ["update"] })

  try {
    const parsed = searchCatalogueSchema.safeParse(input)
    if (!parsed.success) return { success: true, data: [] }
    return { success: true, data: await searchCatalogueProducts(parsed.data.search) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
