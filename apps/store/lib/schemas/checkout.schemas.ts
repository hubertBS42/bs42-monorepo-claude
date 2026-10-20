import { z } from "zod"
import { GEODATA } from "@workspace/contracts"
import { isPossiblePhoneNumber } from "@workspace/utils/phone"

// What checkout asks for. The customer receives the order themselves, so their name and phone are the delivery's.
// Email is required: Paystack needs one, and it's where the order confirmation goes.
export const checkoutFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(200),
    // Trimmed before it's checked, so a pasted space doesn't fail it
    email: z.string().trim().max(254).pipe(z.email("Enter a valid email address")),
    phone: z
      .string()
      .trim()
      .min(1, "Enter a phone number")
      .refine((value) => isPossiblePhoneNumber(value), "Enter a valid phone number"),
    line1: z.string().trim().min(1, "Enter the address").max(300),
    line2: z.string().trim().max(300),
    region: z.string().min(1, "Choose a region"),
    town: z.string().min(1, "Choose a town"),
    notes: z.string().trim().max(1000, "Keep the note under 1,000 characters"),
  })
  .superRefine((data, ctx) => {
    const region = GEODATA.find((item) => item.name === data.region)
    if (data.region && !region) ctx.addIssue({ code: "custom", message: "Choose a region", path: ["region"] })
    else if (region && data.town && !region.towns.includes(data.town)) ctx.addIssue({ code: "custom", message: "Choose a town in the region", path: ["town"] })
  })

export type CheckoutFormValues = z.input<typeof checkoutFormSchema>

// The total the page showed comes back with the order: if the order would cost anything else, it's refused
export const placeOrderSchema = checkoutFormSchema.and(z.object({ expectedTotalGhs: z.string().regex(/^\d+\.\d{2}$/) }))

export const areaSchema = z.object({ region: z.string().min(1), town: z.string().min(1) })
