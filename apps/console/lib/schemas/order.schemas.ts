import z from "zod"
import { OrderStatus, PaymentMethod } from "@workspace/db/enums"

export const orderStatusFormSchema = z
  .object({
    status: z.enum(OrderStatus, "Choose a status"),
    note: z.string().trim().max(1000, "Keep the note under 1,000 characters"),
  })
  .superRefine((data, ctx) => {
    // The customer is told why, and the timeline keeps it
    if (data.status === OrderStatus.CANCELLED && !data.note) {
      ctx.addIssue({ code: "custom", message: "Give a reason for cancelling", path: ["note"] })
    }
  })

// The store and the status the page showed come from the page: the action refuses if the order moved on meanwhile
export const updateStoreOrderStatusSchema = orderStatusFormSchema.extend({
  storeId: z.uuid("Invalid store ID"),
  orderId: z.uuid("Invalid order ID"),
  currentStatus: z.enum(OrderStatus),
})

export const recordStorePaymentSchema = z.object({
  storeId: z.uuid("Invalid store ID"),
  orderId: z.uuid("Invalid order ID"),
  paymentMethod: z.enum(PaymentMethod, "Choose how the customer paid"),
})
