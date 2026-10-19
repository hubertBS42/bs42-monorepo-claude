import { z } from "zod"
import { isPossiblePhoneNumber } from "@workspace/utils/phone"

// An empty field is saved as null. Null is accepted too, so the form's output can be sent to the action as it is.
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)
    .nullable()

export const supplierFormSchema = z.object({
  name: z.string().trim().min(1, "Enter the supplier's name.").max(100, "Keep the name under 100 characters."),
  contactName: optionalText(100, "Keep the name under 100 characters."),
  email: z
    .string()
    .trim()
    .refine((value) => !value || z.email().safeParse(value).success, "Invalid email address.")
    .transform((value) => value.toLowerCase() || null)
    .nullable(),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || isPossiblePhoneNumber(value), "Invalid phone number.")
    .transform((value) => value || null)
    .nullable(),
  address: optionalText(500, "Keep the address under 500 characters."),
  notes: optionalText(2000, "Keep the notes under 2,000 characters."),
})

export const createSupplierSchema = supplierFormSchema.extend({
  storeId: z.uuid("Invalid store ID."),
})

// An archived supplier stays on its purchase orders but can't be chosen for new ones. The form's values: a new
// supplier is never archived, so adding ignores the switch.
export const supplierEditFormSchema = supplierFormSchema.extend({
  isArchived: z.boolean(),
})

export const updateSupplierSchema = supplierEditFormSchema.extend({
  storeId: z.uuid("Invalid store ID."),
  id: z.uuid("Invalid supplier ID."),
})

export const deleteSupplierSchema = z.object({
  storeId: z.uuid("Invalid store ID."),
  id: z.uuid("Invalid supplier ID."),
})
