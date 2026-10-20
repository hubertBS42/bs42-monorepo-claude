import { SpecType } from "@workspace/db/enums"
import { z } from "zod"

// "Not set" in the product form's spec selects, which need a non-empty value for it. The action reads it as no value.
export const SPEC_NOT_SET = "none"

const specOptionSchema = z.object({
  // Saved options keep their id, so renaming one keeps the products that have it
  id: z.uuid().optional(),
  // Checked for blanks only on a choice (below): options left over from switching type don't count
  value: z.string().trim().max(60, "At most 60 characters"),
})

export const categorySpecFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(60, "At most 60 characters"),
    type: z.enum(SpecType),
    // NUMBER only
    unit: z
      .string()
      .trim()
      .max(20, "At most 20 characters")
      .nullable()
      .transform((value) => value || null),
    isFilterable: z.boolean(),
    // SELECT only
    options: z.array(specOptionSchema).max(100, "At most 100 options"),
  })
  .superRefine((data, ctx) => {
    if (data.type !== SpecType.SELECT) return
    if (data.options.length === 0) ctx.addIssue({ code: "custom", message: "Add at least one option", path: ["options"] })
    const seen = new Set<string>()
    data.options.forEach((option, index) => {
      if (!option.value) return ctx.addIssue({ code: "custom", message: "Enter the option", path: ["options", index, "value"] })
      const key = option.value.toLowerCase()
      if (seen.has(key)) ctx.addIssue({ code: "custom", message: `"${option.value}" is listed twice`, path: ["options", index, "value"] })
      seen.add(key)
    })
  })

export const createCategorySpecSchema = z.object({
  categoryId: z.uuid(),
  spec: categorySpecFormSchema,
})

export const updateCategorySpecSchema = z.object({
  id: z.uuid(),
  // The spec as the page showed it: someone else's change in the meantime refuses with CONFLICT
  updatedAt: z.iso.datetime(),
  spec: categorySpecFormSchema,
})

export const deleteCategorySpecSchema = z.object({ id: z.uuid() })

export const moveCategorySpecSchema = z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) })
