"use server"

import { after } from "next/server"
import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { hasStorePermission, requireConsoleAccess } from "@/lib/auth-guard"
import { cancelCollectionSend, CollectionError, handOver, receiveForCollection, sendForCollection } from "@/lib/collection-transfers"
import { markReadyForCollection } from "@/lib/order-updates"
import { sendOrderEmail } from "@workspace/commerce/order-emails"
import { STAFF_ORDER_PAYMENT_METHODS } from "@/lib/schemas/order.schemas"
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

// The collecting branch's own page (/store/collections): any role there tells the customer it's ready, and hands it over
const atBranch = z.object({ storeId: z.uuid(), orderId: z.uuid() })
const handOverSchema = atBranch.extend({ paymentMethod: z.enum(STAFF_ORDER_PAYMENT_METHODS).nullable() })

async function collectingHere(userId: string, storeId: string, orderId: string) {
  if (!(await hasStorePermission(userId, storeId, { order: ["read"] }))) return false
  return !!(await prisma.order.findFirst({ where: { id: orderId, pickupLocation: { organizationId: storeId } }, select: { id: true } }))
}

export async function markCollectionReadyAction(input: z.input<typeof atBranch>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()
  try {
    const parsed = atBranch.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid input", code: "INVALID" }
    if (!(await collectingHere(session.user.id, parsed.data.storeId, parsed.data.orderId))) return FORBIDDEN
    return await markReadyForCollection(parsed.data.orderId)
  } catch (error) {
    return failure(error)
  }
}

export async function handOverAction(input: z.input<typeof handOverSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()
  try {
    const parsed = handOverSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: "Invalid input", code: "INVALID" }
    const { storeId, orderId, paymentMethod } = parsed.data
    if (!(await collectingHere(session.user.id, storeId, orderId))) return FORBIDDEN
    const { paymentRecorded } = await prisma.$transaction((tx) => handOver(tx, { orderId, storeId, userId: session.user.id, paymentMethod }))
    if (paymentRecorded) after(() => sendOrderEmail(orderId, "PAYMENT_RECEIVED"))
    return { success: true }
  } catch (error) {
    return failure(error)
  }
}
