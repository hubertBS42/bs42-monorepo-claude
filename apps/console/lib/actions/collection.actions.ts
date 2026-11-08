"use server"

import { after } from "next/server"
import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { hasStorePermission, requireConsoleAccess } from "@/lib/auth-guard"
import { cancelCollectionSend, CollectionError, receiveForCollection, sendForCollection } from "@/lib/collection-transfers"
import { notifyCollectionTransfer } from "@workspace/commerce/notifications"

// Bringing a pickup order's items to its collecting branch (collection-transfers.ts), from both order pages. The
// sending store's staff who can change its orders send them (and call them back); anyone at the collecting branch
// receives them. Platform admins with order: update do either.

const FORBIDDEN = { success: false as const, error: "Your role can't do this for that store.", code: "FORBIDDEN" }
const transferId = z.object({ transferId: z.uuid() })
const sendSchema = z.object({ orderId: z.uuid(), fromStoreId: z.uuid() })

async function failure(error: unknown): Promise<ActionResponse> {
  if (error instanceof CollectionError) return { success: false, error: error.message, code: error.code }
  return { success: false, error: formatError(error) }
}

const platformMay = (role: string | null | undefined) => hasSystemPermission(role ?? undefined, { order: ["update"] })

export async function sendForCollectionAction(input: z.input<typeof sendSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()
  try {
    const parsed = sendSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid input", code: "INVALID" }
    const { orderId, fromStoreId } = parsed.data
    if (!platformMay(session.user.role) && !(await hasStorePermission(session.user.id, fromStoreId, { order: ["update"] }))) return FORBIDDEN
    const transfer = await prisma.$transaction((tx) => sendForCollection(tx, { orderId, fromStoreId, userId: session.user.id }))
    after(() => notifyCollectionTransfer(transfer.id, "sent", session.user.id))
    return { success: true }
  } catch (error) {
    return failure(error)
  }
}

async function collectingStoreOf(id: string) {
  const transfer = await prisma.collectionTransfer.findUnique({ where: { id }, select: { fromStoreId: true, order: { select: { pickupLocation: { select: { organizationId: true } } } } } })
  return transfer && { fromStoreId: transfer.fromStoreId, collectingStoreId: transfer.order.pickupLocation?.organizationId ?? null }
}

export async function receiveForCollectionAction(input: z.input<typeof transferId>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()
  try {
    const parsed = transferId.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid input", code: "INVALID" }
    const stores = await collectingStoreOf(parsed.data.transferId)
    if (!stores) return { success: false, error: "That delivery wasn't found.", code: "NOT_FOUND" }
    // Any role at the collecting branch: whoever unpacks it
    const allowed = platformMay(session.user.role) || (stores.collectingStoreId && (await hasStorePermission(session.user.id, stores.collectingStoreId, { order: ["read"] })))
    if (!allowed) return FORBIDDEN
    await prisma.$transaction((tx) => receiveForCollection(tx, { transferId: parsed.data.transferId, userId: session.user.id }))
    after(() => notifyCollectionTransfer(parsed.data.transferId, "received", session.user.id))
    return { success: true }
  } catch (error) {
    return failure(error)
  }
}

export async function cancelCollectionSendAction(input: z.input<typeof transferId>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()
  try {
    const parsed = transferId.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid input", code: "INVALID" }
    const stores = await collectingStoreOf(parsed.data.transferId)
    if (!stores) return { success: false, error: "That delivery wasn't found.", code: "NOT_FOUND" }
    if (!platformMay(session.user.role) && !(await hasStorePermission(session.user.id, stores.fromStoreId, { order: ["update"] }))) return FORBIDDEN
    await prisma.$transaction((tx) => cancelCollectionSend(tx, { transferId: parsed.data.transferId, userId: session.user.id }))
    return { success: true }
  } catch (error) {
    return failure(error)
  }
}
