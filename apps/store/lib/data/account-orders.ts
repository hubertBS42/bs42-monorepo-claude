import "server-only"

import { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { orderHref } from "@workspace/commerce/order-links"

export const ACCOUNT_ORDERS_PAGE_SIZE = 10

// Item images shown on an order's row
const PREVIEW_ITEMS = 4

// A customer's orders: those placed signed in, and those placed as a guest (or by staff) with the account's email. Only
// a verified email counts, or anyone could see a stranger's orders by signing up with their address. Nothing is copied
// onto the account, so an order shows in whichever account owns its email at the time.
export function accountOrdersWhere(user: { id: string; email: string; emailVerified: boolean }): Prisma.OrderWhereInput {
  if (!user.emailVerified) return { userId: user.id }
  return { OR: [{ userId: user.id }, { customerEmail: { equals: user.email, mode: "insensitive" } }] }
}

export async function getAccountOrders(user: { id: string; email: string; emailVerified: boolean }, page: number) {
  const where = accountOrdersWhere(user)
  const total = await prisma.order.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / ACCOUNT_ORDERS_PAGE_SIZE))
  const current = Math.min(Math.max(1, page), pageCount)

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * ACCOUNT_ORDERS_PAGE_SIZE,
    take: ACCOUNT_ORDERS_PAGE_SIZE,
    select: {
      id: true,
      reference: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      totalGhs: true,
      orderItems: { orderBy: { id: "asc" }, take: PREVIEW_ITEMS, select: { id: true, productName: true, productImage: true } },
      _count: { select: { orderItems: true } },
    },
  })

  return {
    total,
    page: current,
    pageCount,
    orders: orders.map(({ _count, totalGhs, ...order }) => ({
      ...order,
      totalGhs: totalGhs.toFixed(2),
      itemCount: _count.orderItems,
      // The order page's link, with its key: the account is allowed to see it
      href: orderHref(order.reference, order.id),
    })),
  }
}
