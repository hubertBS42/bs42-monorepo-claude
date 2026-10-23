"use server"

import { after } from "next/server"
import { z } from "zod"
import { formatError } from "@workspace/auth/format-error"
import { notifyStockTransfer } from "@workspace/commerce/notifications"
import type { ActionResponse, DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { getStoreRole, requireConsoleAccess } from "@/lib/auth-guard"
import { findTransferableRows } from "@/lib/data/stock-transfers.data"
import { TRANSFER_ROLES } from "@/lib/stock-transfer-status"
import { cancelStockTransferSchema, createStockTransferSchema, receiveStockTransferSchema, searchTransferableSchema } from "@/lib/schemas/stock-transfer.schemas"
import { cancelStockTransfer, createStockTransfer, receiveStockTransfer, StockTransferError } from "@/lib/stock-transfer-writes"
import type { TransferableRow } from "@/types"

// Every export here is a public endpoint, so every input is validated. Sending needs owner or admin in both stores
// (stores the sender manages, such as one business's branches); receiving, any role in the receiving store (whoever
// unpacks the boxes, as with purchase orders); cancelling, owner or admin in the sending store.

type Refusal = { success: false; error: string; code: string }

function invalidInput(error: z.ZodError): Refusal {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const FORBIDDEN: Refusal = { success: false, error: "You need to be an owner or admin of both stores to transfer stock between them.", code: "FORBIDDEN" }

// The remote database is slow enough that the 5 s default runs out for a transfer with many lines
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 }

function writeError(error: unknown): Refusal {
  if (error instanceof StockTransferError) return { success: false, error: error.message, code: error.code }
  return { success: false, error: formatError(error), code: "ERROR" }
}

const manages = async (userId: string, storeId: string) => TRANSFER_ROLES.includes((await getStoreRole(userId, storeId)) ?? "")

export async function createStockTransferAction(input: z.input<typeof createStockTransferSchema>): Promise<DataResponse<{ id: string; reference: string }>> {
  const { user } = await requireConsoleAccess()

  try {
    const parsed = createStockTransferSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { fromStoreId, toStoreId, notes, lines } = parsed.data
    if (fromStoreId === toStoreId) return { success: false, error: "Choose another store to send to.", code: "INVALID" }
    if (!(await manages(user.id, fromStoreId)) || !(await manages(user.id, toStoreId))) return FORBIDDEN

    const transfer = await prisma.$transaction((tx) => createStockTransfer(tx, { fromStoreId, toStoreId, sentById: user.id, notes, lines }), TRANSACTION_OPTIONS)
    after(() => notifyStockTransfer(transfer.id))
    return { success: true, data: transfer }
  } catch (error) {
    return writeError(error)
  }
}

export async function receiveStockTransferAction(input: z.input<typeof receiveStockTransferSchema>): Promise<ActionResponse> {
  const { user } = await requireConsoleAccess()

  try {
    const parsed = receiveStockTransferSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, transferId, items, note } = parsed.data
    if (!(await getStoreRole(user.id, storeId))) return { success: false, error: "You're not a member of this store.", code: "FORBIDDEN" }

    await prisma.$transaction((tx) => receiveStockTransfer(tx, { storeId, id: transferId, items, note, receivedById: user.id }), TRANSACTION_OPTIONS)
    after(() => notifyStockTransfer(transferId))
    return { success: true }
  } catch (error) {
    return writeError(error)
  }
}

export async function cancelStockTransferAction(input: z.input<typeof cancelStockTransferSchema>): Promise<ActionResponse> {
  const { user } = await requireConsoleAccess()

  try {
    const parsed = cancelStockTransferSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, transferId, reason } = parsed.data
    if (!(await manages(user.id, storeId))) return { success: false, error: "Only the sending store's owners and admins can cancel a transfer.", code: "FORBIDDEN" }

    await prisma.$transaction((tx) => cancelStockTransfer(tx, { storeId, id: transferId, reason, cancelledById: user.id }), TRANSACTION_OPTIONS)
    after(() => notifyStockTransfer(transferId))
    return { success: true }
  } catch (error) {
    return writeError(error)
  }
}

// The form's search for rows to send
export async function searchTransferableAction(input: z.input<typeof searchTransferableSchema>): Promise<DataResponse<TransferableRow[]>> {
  const { user } = await requireConsoleAccess()

  try {
    const parsed = searchTransferableSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { fromStoreId, toStoreId, search } = parsed.data
    if (!(await manages(user.id, fromStoreId)) || (toStoreId && !(await manages(user.id, toStoreId)))) return FORBIDDEN

    return { success: true, data: await findTransferableRows(fromStoreId, toStoreId, search) }
  } catch (error) {
    return writeError(error)
  }
}
