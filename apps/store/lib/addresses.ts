import "server-only"

import { prisma } from "@workspace/db"

// A customer's saved delivery addresses. One of them is the default (the first one saved, until another is chosen),
// which checkout fills in.

export const MAX_SAVED_ADDRESSES = 10

export class AddressError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export interface AddressInput {
  name: string
  phone: string
  line1: string
  line2: string
  region: string
  town: string
}

const addressSelect = { id: true, name: true, phone: true, line1: true, line2: true, region: true, town: true, isDefault: true } as const

// The default first, then the newest
export async function getSavedAddresses(userId: string) {
  return prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }], select: addressSelect })
}

export async function getSavedAddress(userId: string, id: string) {
  return prisma.address.findFirst({ where: { id, userId }, select: addressSelect })
}

const fields = (input: AddressInput) => ({ name: input.name, phone: input.phone, line1: input.line1, line2: input.line2 || null, region: input.region, town: input.town })

// Adds an address, or changes one of the customer's own (a stranger's id isn't found). The first address is the default
// whatever was asked; making another the default takes it from the old one.
export async function saveAddress(userId: string, input: AddressInput & { isDefault: boolean }, id?: string) {
  await prisma.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.address.findFirst({ where: { id, userId }, select: { isDefault: true } })
      if (!existing) throw new AddressError("NOT_FOUND", "We can't find that address. It may have been removed.")
      // The default stays the default until another is chosen, so there's always one
      const isDefault = existing.isDefault || input.isDefault
      if (isDefault && !existing.isDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
      await tx.address.update({ where: { id }, data: { ...fields(input), isDefault } })
      return
    }

    const count = await tx.address.count({ where: { userId } })
    if (count >= MAX_SAVED_ADDRESSES) throw new AddressError("TOO_MANY", `You can save up to ${MAX_SAVED_ADDRESSES} addresses. Remove one to add another.`)
    const isDefault = count === 0 || input.isDefault
    if (isDefault && count > 0) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
    await tx.address.create({ data: { ...fields(input), isDefault, userId } })
  })
}

export async function makeDefaultAddress(userId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const found = await tx.address.count({ where: { id, userId } })
    if (!found) throw new AddressError("NOT_FOUND", "We can't find that address. It may have been removed.")
    await tx.address.updateMany({ where: { userId, isDefault: true, id: { not: id } }, data: { isDefault: false } })
    await tx.address.update({ where: { id }, data: { isDefault: true } })
  })
}

// Removing the default makes the newest of the others the default
export async function removeAddress(userId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const removed = await tx.address.deleteMany({ where: { id, userId } })
    if (!removed.count) return
    if (await tx.address.count({ where: { userId, isDefault: true } })) return
    const newest = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true } })
    if (newest) await tx.address.update({ where: { id: newest.id }, data: { isDefault: true } })
  })
}

// Checkout's "Save this address": kept unless the customer already has it, or has as many as they can keep. It never
// fails the order it came with.
export async function rememberAddress(userId: string, input: AddressInput) {
  try {
    const same = await prisma.address.count({ where: { userId, ...fields(input) } })
    if (same) return
    await saveAddress(userId, { ...input, isDefault: false })
  } catch (error) {
    if (error instanceof AddressError) return
    console.error("Could not save an address from checkout:", error)
  }
}
