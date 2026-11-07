import { z } from "zod"
import { GEODATA } from "@workspace/contracts"
import { isPossiblePhoneNumber } from "@workspace/utils/phone"

// A delivery address, as checkout and the account's saved addresses ask for it. The name and phone are whoever
// receives the delivery.
export const addressFields = {
  name: z.string().trim().min(1, "Enter your name").max(200),
  phone: z
    .string()
    .trim()
    .min(1, "Enter a phone number")
    .refine((value) => isPossiblePhoneNumber(value), "Enter a valid phone number"),
  line1: z.string().trim().min(1, "Enter the address").max(300),
  line2: z.string().trim().max(300),
  region: z.string().min(1, "Choose a region"),
  town: z.string().min(1, "Choose a town"),
}

// Delivered to an address, or collected from the store's pickup location: the address fields are only asked for, and
// only checked, for a delivery. Its name and phone are the customer's either way.
export const fulfilmentFields = {
  method: z.enum(["DELIVERY", "PICKUP"]),
  name: addressFields.name,
  phone: addressFields.phone,
  line1: z.string().trim().max(300),
  line2: addressFields.line2,
  region: z.string(),
  town: z.string(),
}

export function checkFulfilment(data: { method: "DELIVERY" | "PICKUP"; line1: string; region: string; town: string }, ctx: z.RefinementCtx) {
  if (data.method === "PICKUP") return
  if (!data.line1) ctx.addIssue({ code: "custom", message: "Enter the address", path: ["line1"] })
  if (!data.region) ctx.addIssue({ code: "custom", message: "Choose a region", path: ["region"] })
  else if (!data.town) ctx.addIssue({ code: "custom", message: "Choose a town", path: ["town"] })
  checkArea(data, ctx)
}

// The town must be one of the region's (GEODATA's names, which delivery fees use too)
export function checkArea(data: { region: string; town: string }, ctx: z.RefinementCtx) {
  const region = GEODATA.find((item) => item.name === data.region)
  if (data.region && !region) ctx.addIssue({ code: "custom", message: "Choose a region", path: ["region"] })
  else if (region && data.town && !region.towns.includes(data.town)) ctx.addIssue({ code: "custom", message: "Choose a town in the region", path: ["town"] })
}

export const addressSchema = z.object({ ...addressFields, isDefault: z.boolean() }).superRefine(checkArea)

export type AddressValues = z.input<typeof addressSchema>
