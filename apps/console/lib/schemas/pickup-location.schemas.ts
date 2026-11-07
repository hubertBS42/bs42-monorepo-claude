import z from "zod"
import { isPossiblePhoneNumber } from "@workspace/utils/phone"

// A store's pickup location, as customers see it
export const pickupLocationFormSchema = z.object({
  name: z.string().trim().min(1, "Enter the name customers see").max(100),
  address: z.string().trim().min(1, "Enter the address").max(300),
  hours: z.string().trim().max(200),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || isPossiblePhoneNumber(value), "Invalid phone number"),
  mapUrl: z.union([z.literal(""), z.httpUrl("Enter a web address starting with https://")]),
})

// The store comes from the page; updatedAt is the version the card loaded (null when there was none)
export const savePickupLocationSchema = pickupLocationFormSchema.extend({
  storeId: z.uuid("Invalid store ID"),
  updatedAt: z.iso.datetime().nullable(),
})

export const removePickupLocationSchema = z.object({ storeId: z.uuid("Invalid store ID") })
