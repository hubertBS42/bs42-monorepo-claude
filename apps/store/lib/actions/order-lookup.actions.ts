"use server"

import { after } from "next/server"
import { authURLs } from "@workspace/auth/constants"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { OrderLinkEmail, sendEmail } from "@workspace/email"

import { orderHref } from "@/lib/order-access"
import { findOrderSchema, type FindOrderValues } from "@/lib/schemas/account.schemas"
import { getAppSettings, getStoreName } from "@/lib/settings"

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

      const [settings, storeName] = await Promise.all([getAppSettings(), getStoreName()])
      await sendEmail({
        to: order.customerEmail,
        fromName: storeName,
        subject: `Your link to order ${order.reference}`,
        reactTemplate: OrderLinkEmail({
          name: order.customerName.split(" ")[0] || order.customerName,
          reference: order.reference,
          url: new URL(orderHref(order.reference, order.id), authURLs.store).toString(),
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
