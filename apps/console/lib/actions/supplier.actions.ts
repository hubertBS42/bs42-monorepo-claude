"use server"

import z from "zod"
import { formatError } from "@workspace/auth/format-error"
import { ActionResponse, DataResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { hasStorePermission, requireConsoleAccess } from "@/lib/auth-guard"
import { createSupplierSchema, deleteSupplierSchema, updateSupplierSchema } from "@/lib/schemas/supplier.schemas"

// Every export here is a public endpoint, so every input is validated, and each one calls requireConsoleAccess before
// its try block (its redirect throws, which the catch would swallow). The store id comes from the page, not the
// session's active organization, and the store role is checked against it.

type Failure = Extract<ActionResponse, { success: false }>

function invalidInput(error: z.ZodError): Failure {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
}

const FORBIDDEN: Failure = { success: false, error: "Your role in this store can't manage suppliers.", code: "FORBIDDEN" }
const NOT_FOUND: Failure = { success: false, error: "This supplier no longer exists. Refresh the page.", code: "NOT_FOUND" }
const NAME_EXISTS: Failure = { success: false, error: "This store already has a supplier with this name.", code: "NAME_EXISTS" }
const HAS_PURCHASE_ORDERS: Failure = {
  success: false,
  error: "This supplier is on purchase orders, so it can't be deleted. Archive it instead.",
  code: "HAS_PURCHASE_ORDERS",
}

// (organizationId, name) is unique but case-sensitive, so "Acme" and "acme" are caught here instead
async function isNameTaken(storeId: string, name: string, excludeId?: string) {
  const existing = await prisma.supplier.findFirst({
    where: { organizationId: storeId, name: { equals: name, mode: "insensitive" }, ...(excludeId && { id: { not: excludeId } }) },
    select: { id: true },
  })
  return !!existing
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export async function createSupplierAction(input: z.input<typeof createSupplierSchema>): Promise<DataResponse<{ id: string }>> {
  const session = await requireConsoleAccess()

  try {
    const parsed = createSupplierSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, ...data } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { supplier: ["create"] }))) return FORBIDDEN
    if (await isNameTaken(storeId, data.name)) return NAME_EXISTS

    const supplier = await prisma.supplier.create({ data: { ...data, organizationId: storeId }, select: { id: true } })
    return { success: true, data: supplier }
  } catch (error) {
    if (isUniqueConstraintError(error)) return NAME_EXISTS
    return { success: false, error: formatError(error) }
  }
}

export async function updateSupplierAction(input: z.input<typeof updateSupplierSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = updateSupplierSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, id, ...data } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { supplier: ["update"] }))) return FORBIDDEN
    if (await isNameTaken(storeId, data.name, id)) return NAME_EXISTS

    const { count } = await prisma.supplier.updateMany({ where: { id, organizationId: storeId }, data })
    if (count === 0) return NOT_FOUND
    return { success: true }
  } catch (error) {
    if (isUniqueConstraintError(error)) return NAME_EXISTS
    return { success: false, error: formatError(error) }
  }
}

export async function deleteSupplierAction(input: z.input<typeof deleteSupplierSchema>): Promise<ActionResponse> {
  const session = await requireConsoleAccess()

  try {
    const parsed = deleteSupplierSchema.safeParse(input)
    if (!parsed.success) return invalidInput(parsed.error)
    const { storeId, id } = parsed.data

    if (!(await hasStorePermission(session.user.id, storeId, { supplier: ["delete"] }))) return FORBIDDEN

    // Purchase orders restrict the delete, so a supplier that has been used can only be archived
    if (await prisma.purchaseOrder.findFirst({ where: { supplierId: id }, select: { id: true } })) return HAS_PURCHASE_ORDERS

    const { count } = await prisma.supplier.deleteMany({ where: { id, organizationId: storeId } })
    if (count === 0) return NOT_FOUND
    return { success: true }
  } catch (error) {
    // Used on a purchase order between the check and the delete
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return HAS_PURCHASE_ORDERS
    return { success: false, error: formatError(error) }
  }
}
