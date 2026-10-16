import { Status } from "@workspace/db/enums"
import { z } from "zod"
import { optionalHttpUrl } from "./common.schemas"

export const addBrandFormSchema = z.object({
  name: z.string().trim().min(1, "You must provide a brand name.").min(3, "Brand name must be at least 3 characters.").max(100, "Brand name must be at most 100 characters."),
  logo: optionalHttpUrl("Invalid logo URL."),
  // People type "nike.com", so a missing scheme becomes https://. "javascript:…" has no "://", gets the prefix and then fails the check.
  website: z
    .string()
    .trim()
    .transform((value) => (value && !value.includes("://") ? `https://${value}` : value))
    .pipe(optionalHttpUrl("Invalid website URL.").unwrap())
    .nullable(),
  description: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable(),
  isFeatured: z.boolean(),
  status: z.enum(Status),
})

export const updateBrandFormSchema = addBrandFormSchema.extend({
  id: z.uuid("Invalid brand ID."),
})
