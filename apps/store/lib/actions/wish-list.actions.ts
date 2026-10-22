"use server"

import type { DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { z } from "zod"

import { getStoreSession } from "@/lib/session"
import { removeWishListItem, saveWishListItem, WishListError, type WishListKey } from "@/lib/wish-list"

// The hearts' actions, for the signed-in customer's own list. A signed-out visitor's heart goes to sign in instead.

const SIGNED_OUT = { success: false as const, error: "Sign in to save items to your wish list.", code: "UNAUTHORIZED" }
const INVALID = { success: false as const, error: "Invalid item.", code: "INVALID_INPUT" }

const keySchema = z.object({ productId: z.uuid(), variantId: z.uuid().nullable() })

export async function saveToWishListAction(input: WishListKey): Promise<DataResponse<{ count: number }>> {
  const session = await getStoreSession()
  if (!session) return SIGNED_OUT
  const parsed = keySchema.safeParse(input)
  if (!parsed.success) return INVALID

  try {
    return { success: true, data: { count: await saveWishListItem(prisma, session.user.id, parsed.data) } }
  } catch (error) {
    if (error instanceof WishListError) return { success: false, error: error.message, code: error.code }
    console.error("Could not save to a wish list:", error)
    return { success: false, error: "We couldn't save that just now. Please try again." }
  }
}

export async function removeFromWishListAction(input: WishListKey): Promise<DataResponse<{ count: number }>> {
  const session = await getStoreSession()
  if (!session) return SIGNED_OUT
  const parsed = keySchema.safeParse(input)
  if (!parsed.success) return INVALID

  try {
    return { success: true, data: { count: await removeWishListItem(prisma, session.user.id, parsed.data) } }
  } catch (error) {
    console.error("Could not remove from a wish list:", error)
    return { success: false, error: "We couldn't remove that just now. Please try again." }
  }
}
