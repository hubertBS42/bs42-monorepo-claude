import { z } from "zod"

import { addressFields, checkArea } from "@/lib/schemas/address.schemas"

// What checkout asks for. The customer receives the order themselves, so their name and phone are the delivery's.
// Email is required: Paystack needs one, and it's where the order confirmation goes.
export const checkoutFormSchema = z
  .object({
    ...addressFields,
    // Trimmed before it's checked, so a pasted space doesn't fail it
    email: z.string().trim().max(254).pipe(z.email("Enter a valid email address")),
    notes: z.string().trim().max(1000, "Keep the note under 1,000 characters"),
    // Signed in: keep the address in the account for next time
    saveAddress: z.boolean().optional(),
  })
  .superRefine(checkArea)

export type CheckoutFormValues = z.input<typeof checkoutFormSchema>

// The total the page showed comes back with the order: if the order would cost anything else, it's refused
export const placeOrderSchema = checkoutFormSchema.and(z.object({ expectedTotalGhs: z.string().regex(/^\d+\.\d{2}$/) }))

export const areaSchema = z.object({ region: z.string().min(1), town: z.string().min(1) })
