"use server"
import { z } from "zod"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { Status } from "@workspace/db/enums"
import { formatError } from "@workspace/auth/format-error"
import type { ActionResponse, DataResponse } from "@workspace/contracts"
import { requireSystemPermission } from "@/lib/auth-guard"
import { MAX_PAIRINGS, ownerWhere } from "@/lib/data/pairings.data"
import { searchCatalogueProducts } from "@/lib/data/product-requests.data"
import { addPairingSchema, movePairingSchema, removePairingSchema, searchPairableSchema } from "@/lib/schemas/pairing.schemas"
import type { CatalogueProductOption, PairingOwner } from "@/types"

// "Pairs well with" lists, a category's or a product's. Every export here is a public endpoint, so every input is
// validated; a category's list needs the category permission, a product's the product permission. Each change saves on
// its own, and the page shows the list as it is after any change, so moves and removals act on ids, not positions.

const NOT_FOUND: ActionResponse = { success: false, error: "This product is no longer on the list.", code: "NOT_FOUND" }
const OWNER_NOT_FOUND: ActionResponse = { success: false, error: "This category or product no longer exists.", code: "NOT_FOUND" }

function invalidInput(error: z.ZodError): ActionResponse {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

// Outside each action's try block: redirect() works by throwing and must not be caught. The input isn't checked yet,
// so anything but a category's list asks for the product permission.
async function requireOwnerPermission(input: { owner?: { kind?: unknown } } | undefined) {
  await requireSystemPermission(input?.owner?.kind === "category" ? { category: ["update"] } : { product: ["update"] })
}

async function ownerExists(owner: PairingOwner) {
  const found =
    owner.kind === "category" ? await prisma.category.findUnique({ where: { id: owner.id }, select: { id: true } }) : await prisma.product.findUnique({ where: { id: owner.id }, select: { id: true } })
  return !!found
}

// Catalogue products to add, by name, SKU or barcode (archived ones can't be sold, so they're left out)
export async function searchPairableProductsAction(input: z.input<typeof searchPairableSchema>): Promise<DataResponse<CatalogueProductOption[]>> {
  await requireOwnerPermission(input)

  try {
    const parsed = searchPairableSchema.safeParse(input)
    if (!parsed.success) return { success: true, data: [] }
    const { owner, search } = parsed.data
    const products = await searchCatalogueProducts(search)
    return { success: true, data: products.filter((product) => product.status !== Status.ARCHIVED && !(owner.kind === "product" && product.id === owner.id)) }
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function addPairingAction(input: z.input<typeof addPairingSchema>): Promise<ActionResponse> {
  await requireOwnerPermission(input)

  try {
    const parsed = addPairingSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { owner, productId } = parsed.data

    if (owner.kind === "product" && owner.id === productId) return { success: false, error: "A product can't pair with itself.", code: "SELF" }
    if (!(await ownerExists(owner))) return OWNER_NOT_FOUND
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { status: true } })
    if (!product || product.status === Status.ARCHIVED) return { success: false, error: "That product is archived or no longer exists.", code: "PRODUCT_UNAVAILABLE" }

    const where = ownerWhere(owner)
    const [count, last] = await Promise.all([prisma.productPairing.count({ where }), prisma.productPairing.aggregate({ where, _max: { position: true } })])
    if (count >= MAX_PAIRINGS) return { success: false, error: `A list holds at most ${MAX_PAIRINGS} products. Remove one first.`, code: "LIMIT" }

    await prisma.productPairing.create({ data: { ...where, pairedProductId: productId, position: (last._max.position ?? -1) + 1 } })
    return { success: true }
  } catch (error) {
    // Added already, perhaps from another tab
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { success: false, error: "That product is already on the list.", code: "EXISTS" }
    return { success: false, error: formatError(error) }
  }
}

export async function removePairingAction(input: z.input<typeof removePairingSchema>): Promise<ActionResponse> {
  await requireOwnerPermission(input)

  try {
    const parsed = removePairingSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { owner, id } = parsed.data

    // Only from the list the page shows, which the permission was checked for
    const { count } = await prisma.productPairing.deleteMany({ where: { id, ...ownerWhere(owner) } })
    return count ? { success: true } : NOT_FOUND
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}

export async function movePairingAction(input: z.input<typeof movePairingSchema>): Promise<ActionResponse> {
  await requireOwnerPermission(input)

  try {
    const parsed = movePairingSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { owner, id, direction } = parsed.data

    const moved = await prisma.$transaction(
      async (tx) => {
        const rows = await tx.productPairing.findMany({ where: ownerWhere(owner), select: { id: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] })
        const order = rows.map((row) => row.id)
        const from = order.indexOf(id)
        if (from < 0) return false
        const to = direction === "up" ? from - 1 : from + 1
        if (to < 0 || to >= order.length) return true
        ;[order[from], order[to]] = [order[to]!, order[from]!]
        // Renumbered from 0, so ties from before don't stop the move
        for (const [position, rowId] of order.entries()) await tx.productPairing.update({ where: { id: rowId }, data: { position } })
        return true
      },
      { maxWait: 10_000, timeout: 30_000 }
    )
    return moved ? { success: true } : NOT_FOUND
  } catch (error) {
    return { success: false, error: formatError(error) }
  }
}
