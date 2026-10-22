"use server"

import { refresh } from "next/cache"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import type { DataResponse } from "@workspace/contracts"
import { formatError } from "@workspace/auth/format-error"
import { z } from "zod"
import { isOrderKey } from "@workspace/commerce/order-links"

import { MAX_LINE_QUANTITY } from "@/lib/basket-limits"
import { addCartItem, CartError, countCartItems, removeCartItem, setCartItemInstallation, setCartItemQuantity, type AddToCartInput } from "@/lib/cart"
import { ensureCartId, readCartId } from "@/lib/cart-cookie"

// The basket's actions. Anyone can call them: the cookie is the only key to a basket, and every line is checked again
// when the basket is shown and when the order is placed.

const quantitySchema = z.number().int().min(0).max(MAX_LINE_QUANTITY)

const addSchema = z.object({
  listingId: z.uuid(),
  listingVariantId: z.uuid().nullable(),
  quantity: quantitySchema.min(1),
  installation: z.boolean().optional(),
})

// Two adds at once (two tabs) can both try to create the basket or the item's line, and the second fails on the
// unique key. Adding again then finds the row the first one made.
async function addOnce(cartId: string, input: AddToCartInput) {
  try {
    return await addCartItem(prisma, cartId, input)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return addCartItem(prisma, cartId, input)
    throw error
  }
}

function failure(error: unknown) {
  if (error instanceof CartError) return { success: false as const, error: error.message, code: error.code }
  return { success: false as const, error: formatError(error) }
}

export async function addToBasketAction(input: z.input<typeof addSchema>): Promise<DataResponse<{ added: number; quantity: number; capped: boolean; count: number }>> {
  try {
    const parsed = addSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid item.", code: "INVALID_INPUT" }

    const result = await addOnce(await ensureCartId(), parsed.data)
    return { success: true, data: result }
  } catch (error) {
    return failure(error)
  }
}

// 0 removes the line. The basket page shows the result, so it's refreshed.
export async function setBasketQuantityAction(lineId: string, quantity: number): Promise<DataResponse<{ quantity: number; capped: boolean; count: number }>> {
  try {
    const parsed = z.object({ lineId: z.uuid(), quantity: quantitySchema }).safeParse({ lineId, quantity })
    if (!parsed.success) return { success: false, error: "Invalid quantity.", code: "INVALID_INPUT" }

    const cartId = await readCartId()
    if (!cartId) return failure(new CartError("LINE_NOT_FOUND"))
    const result = await setCartItemQuantity(prisma, cartId, parsed.data.lineId, parsed.data.quantity)
    refresh()
    return { success: true, data: result }
  } catch (error) {
    return failure(error)
  }
}

// Installation of every unit on a line, on or off. The basket page shows the result, so it's refreshed.
export async function setBasketInstallationAction(lineId: string, withInstallation: boolean): Promise<DataResponse<null>> {
  try {
    const parsed = z.object({ lineId: z.uuid(), withInstallation: z.boolean() }).safeParse({ lineId, withInstallation })
    if (!parsed.success) return { success: false, error: "Invalid item.", code: "INVALID_INPUT" }

    const cartId = await readCartId()
    if (!cartId) return failure(new CartError("LINE_NOT_FOUND"))
    await setCartItemInstallation(prisma, cartId, parsed.data.lineId, parsed.data.withInstallation)
    refresh()
    return { success: true, data: null }
  } catch (error) {
    return failure(error)
  }
}

export async function removeFromBasketAction(lineId: string): Promise<DataResponse<{ count: number }>> {
  try {
    if (!z.uuid().safeParse(lineId).success) return { success: false, error: "Invalid item.", code: "INVALID_INPUT" }

    const cartId = await readCartId()
    const result = cartId ? await removeCartItem(prisma, cartId, lineId) : { count: 0 }
    refresh()
    return { success: true, data: result }
  } catch (error) {
    return failure(error)
  }
}

// "Put these items back in your basket" on a cancelled order's page. Each line goes in as if added again, at today's
// stores and stock; what can't be bought any more is named.
export async function reorderAction(orderId: string, key: string): Promise<DataResponse<{ count: number; missed: string[] }>> {
  try {
    if (!isOrderKey(orderId, key)) return { success: false, error: "We can't find that order.", code: "NOT_FOUND" }
    const items = await prisma.orderItem.findMany({
      where: { orderId },
      orderBy: { id: "asc" },
      select: { storeListingId: true, storeListingVariantId: true, quantity: true, productName: true, variantDescription: true },
    })

    const cartId = await ensureCartId()
    const missed: string[] = []
    for (const item of items) {
      try {
        await addOnce(cartId, { listingId: item.storeListingId, listingVariantId: item.storeListingVariantId, quantity: Math.min(item.quantity, MAX_LINE_QUANTITY) })
      } catch (error) {
        if (!(error instanceof CartError)) throw error
        missed.push(item.variantDescription ? `${item.productName} (${item.variantDescription})` : item.productName)
      }
    }
    return { success: true, data: { count: await countCartItems(prisma, cartId), missed } }
  } catch (error) {
    return failure(error)
  }
}
