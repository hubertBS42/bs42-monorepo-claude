import { Status } from "@workspace/db/enums"
import { z } from "zod"
import { optionalHttpUrl } from "./common.schemas"
import { optionalDecimalSchema } from "./product.schemas"

// The parent select's value for a top-level category. Selects need a string, so the schema turns it into null (null itself is also accepted).
export const NO_PARENT = "none"

export const addCategoryFormSchema = z.object({
  name: z.string().trim().min(1, "You must provide a category name.").max(100, "Category name must be at most 100 characters."),
  image: optionalHttpUrl("Invalid image URL."),
  parentId: z.union([z.literal(NO_PARENT).transform(() => null), z.uuid("Invalid parent category.")]).nullable(),
  description: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable(),
  isFeatured: z.boolean(),
  // GHS per item; empty: the parent's applies, or none
  installationFeeGhs: optionalDecimalSchema.refine((fee) => fee == null || fee > 0, "Leave it empty for no fee of its own"),
  status: z.enum(Status),
})

export const updateCategoryFormSchema = addCategoryFormSchema.extend({
  id: z.uuid("Invalid category ID."),
})
