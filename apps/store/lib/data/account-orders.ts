import "server-only"

import { prisma } from "@workspace/db"
import { accountOrdersWhere } from "@workspace/commerce/customer-orders"
import { invoiceHref, orderHref } from "@workspace/commerce/order-links"

export const ACCOUNT_ORDERS_PAGE_SIZE = 10

// Item images shown on an order's row
const PREVIEW_ITEMS = 4

// The account's orders (accountOrdersWhere), newest first
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
      // The order page's and invoice's links, with their keys: the account is allowed to see them
      href: orderHref(order.reference, order.id),
      invoiceHref: invoiceHref(order.reference, order.id),
    })),
  }
}
