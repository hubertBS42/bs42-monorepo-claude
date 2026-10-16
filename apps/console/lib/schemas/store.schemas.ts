import { StoreStatus } from "@/types"
import z from "zod"

export const addStoreFormSchema = z.object({
  name: z.string().trim().min(1, "You must provide a store name").min(3, "Store name must be at least 3 characters").max(100, "Store name must be at most 100 characters"),
  logo: z.httpUrl("Invalid URL").optional().or(z.literal("")),
  shippingPolicy: z.string().nullable(),
  returnsPolicy: z.string().nullable(),
  status: z.enum(StoreStatus),
})

export const updateStoreFormSchema = addStoreFormSchema.extend({
  id: z.uuid("Invalid store ID."),
})
