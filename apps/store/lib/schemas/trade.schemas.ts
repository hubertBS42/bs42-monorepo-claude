import { z } from "zod"
import { BusinessType } from "@workspace/db/enums"
import { isPossiblePhoneNumber } from "@workspace/utils/phone"

// A trade account application, as the storefront's form sends it
export const tradeApplicationSchema = z.object({
  companyName: z.string().trim().min(2, "Enter the company's name").max(200),
  registrationNumber: z.string().trim().min(2, "Enter the company's registration number").max(50),
  // The GRA's taxpayer number (e.g. C0012345678), or a Ghana Card number for a sole trader (GHA-123456789-0)
  tin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]\d{10}|GHA-\d{9}-\d)$/, "Enter the TIN as the GRA gives it, e.g. C0012345678, or a Ghana Card number"),
  phone: z
    .string()
    .trim()
    .min(1, "Enter a phone number")
    .refine((value) => isPossiblePhoneNumber(value), "Enter a valid phone number"),
  // Empty until one is chosen
  businessType: z
    .union([z.enum(BusinessType), z.literal("")])
    .refine((value) => value !== "", "Choose what the business does")
    .transform((value) => value as BusinessType),
  details: z.string().trim().max(1000, "Keep it under 1,000 characters"),
})

export type TradeApplicationValues = z.input<typeof tradeApplicationSchema>
