"use server"

import { refresh } from "next/cache"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import type { DataResponse } from "@workspace/contracts"
import { formatError } from "@workspace/auth/format-error"
import { z } from "zod"
import { isOrderKey, isQuoteKey } from "@workspace/commerce/order-links"

import { MAX_LINE_QUANTITY, TRADE_LINE_QUANTITY } from "@/lib/basket-limits"
import { addCartItem, CartError, countCartItems, removeCartItem, setCartItemInstallation, setCartItemQuantity, type AddToCartInput } from "@/lib/cart"
import { ensureCartId, readCartId } from "@/lib/cart-cookie"
import { getTradeTerms } from "@/lib/session"

// The basket's actions. Anyone can call them: the cookie is the only key to a basket, and every line is checked again
// when the basket is shown and when the order is placed.

// Up to a trade account's limit here; the basket caps it at the customer's own (maxLine)
const quantitySchema = z.number().int().min(0).max(TRADE_LINE_QUANTITY)

// The most one of the customer's lines holds
const maxLine = async () => ((await getTradeTerms()) ? TRADE_LINE_QUANTITY : MAX_LINE_QUANTITY)

const addSchema = z.object({
  listingId: z.uuid(),
  listingVariantId: z.uuid().nullable(),
  quantity: quantitySchema.min(1),
  installation: z.boolean().optional(),
})

// Two adds at once (two tabs) can both try to create the basket or the item's line, and the second fails on the
// unique key. Adding again then finds the row the first one made.
async function addOnce(cartId: string, input: AddToCartInput) {
  const max = await maxLine()
  try {
    return await addCartItem(prisma, cartId, input, max)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return addCartItem(prisma, cartId, input, max)
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
    const result = await setCartItemQuantity(prisma, cartId, parsed.data.lineId, parsed.data.quantity, await maxLine())
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

// "Put these items back in your basket" on a cancelled order's page. Each line goes in at today's stores and stock,
// topping up an item already in the basket to the order's quantity rather than adding to it; what can't be bought any
// more is named.
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
        await addOnce(cartId, { listingId: item.storeListingId, listingVariantId: item.storeListingVariantId, quantity: Math.min(item.quantity, TRADE_LINE_QUANTITY), atLeast: true })
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

// "Put these items in your basket" on a quotation that lapsed or can't be supplied in full. Each line goes in at today's
// stores, stock and prices, with its installation, topping up an item already in the basket to the quoted quantity
// rather than adding to it (making a quote keeps the basket); what can't be bought any more is named.
export async function quoteToBasketAction(quoteId: string, key: string): Promise<DataResponse<{ count: number; missed: string[] }>> {
  try {
    if (!isQuoteKey(quoteId, key)) return { success: false, error: "We can't find that quotation.", code: "NOT_FOUND" }
    const items = await prisma.quoteItem.findMany({
      where: { quoteId },
      orderBy: { id: "asc" },
      select: { storeListingId: true, storeListingVariantId: true, hasVariant: true, quantity: true, installationUnitGhs: true, productName: true, variantDescription: true },
    })

    const cartId = await ensureCartId()
    const missed: string[] = []
    for (const item of items) {
      const label = item.variantDescription ? `${item.productName} (${item.variantDescription})` : item.productName
      // Deleted since it was quoted
      if (!item.storeListingId || (item.hasVariant && !item.storeListingVariantId)) {
        missed.push(label)
        continue
      }
      const input = { listingId: item.storeListingId, listingVariantId: item.storeListingVariantId, quantity: Math.min(item.quantity, TRADE_LINE_QUANTITY), atLeast: true }
      try {
        await addOnce(cartId, { ...input, installation: !!item.installationUnitGhs })
      } catch (error) {
        if (!(error instanceof CartError)) throw error
        // Installation no longer offered: the item still goes in, without it
        if (error.code === "NO_INSTALLATION") {
          await addOnce(cartId, input).catch((retry) => {
            if (!(retry instanceof CartError)) throw retry
            missed.push(label)
          })
        } else missed.push(label)
      }
    }
    return { success: true, data: { count: await countCartItems(prisma, cartId), missed } }
  } catch (error) {
    return failure(error)
  }
}
