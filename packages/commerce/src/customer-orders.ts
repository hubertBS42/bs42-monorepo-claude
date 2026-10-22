import type { Prisma } from "@workspace/db/client"

// The orders that belong to a customer's account: those placed signed in, and those placed as a guest (or by staff)
// with the account's email. Only a verified email counts, or anyone could see a stranger's orders by signing up with
// their address. Nothing is copied onto the account, so an order belongs to whichever account owns its email at the time.
export function accountOrdersWhere(user: { id: string; email: string; emailVerified: boolean }): Prisma.OrderWhereInput {
  if (!user.emailVerified) return { userId: user.id }
  return { OR: [{ userId: user.id }, { customerEmail: { equals: user.email, mode: "insensitive" } }] }
}
