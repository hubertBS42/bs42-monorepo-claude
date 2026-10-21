"use server"

import { after } from "next/server"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { OrderLinkEmail, sendEmail } from "@workspace/email"
import { orderUrl } from "@workspace/commerce/order-links"

import { findOrderSchema, type FindOrderValues } from "@/lib/schemas/account.schemas"
import { getAppSettings, getStoreName } from "@/lib/settings"

// One link email per order in this long, however often it's asked for, so nobody can fill a customer's inbox with them
const ORDER_LINK_INTERVAL_MINUTES = 10

// "Find an order": the order's link goes to the order's own email, never to the page. Whoever asks gets the same
// answer whether or not the order exists, so references and emails can't be tried out here, and a receipt that's
// been seen or passed on doesn't open the order (its name, address and phone).
export async function findOrderAction(input: FindOrderValues): Promise<ActionResponse> {
  const parsed = findOrderSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the reference and email.", code: "INVALID_INPUT" }

  const { reference, email } = parsed.data
  // After the answer, so how long it takes doesn't say whether there was an order to email
  after(async () => {
    try {
      const order = await prisma.order.findFirst({
        where: { reference, customerEmail: { equals: email, mode: "insensitive" } },
        select: { id: true, reference: true, customerName: true, customerEmail: true },
      })
      if (!order?.customerEmail) return

      // Claimed in one statement, so two requests at once can't both send it
      const since = new Date(Date.now() - ORDER_LINK_INTERVAL_MINUTES * 60_000)
      const claimed = await prisma.order.updateMany({
        where: { id: order.id, OR: [{ orderLinkSentAt: null }, { orderLinkSentAt: { lt: since } }] },
        data: { orderLinkSentAt: new Date() },
      })
      if (!claimed.count) return

      const [settings, storeName] = await Promise.all([getAppSettings(), getStoreName()])
      await sendEmail({
        to: order.customerEmail,
        fromName: storeName,
        subject: `Your link to order ${order.reference}`,
        reactTemplate: OrderLinkEmail({
          name: order.customerName.split(" ")[0] || order.customerName,
          reference: order.reference,
          url: orderUrl(order.reference, order.id),
          appName: storeName,
          logoUrl: settings.logoUrl,
        }),
      })
    } catch (error) {
      console.error(`Could not send the link to order ${reference}:`, error)
    }
  })
  return { success: true }
}
