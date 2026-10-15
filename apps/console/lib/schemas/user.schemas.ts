import { ORG_ROLE_NAMES } from "@workspace/auth/organization-permissions"
import { isPossiblePhoneNumber } from "@workspace/utils/phone"
import z from "zod"

// Optional phone schema (for fields that can be null/empty)
const optionalPhoneSchema = z
  .string()
  .nullable()
  .refine(
    (data) => {
      if (!data) return true
      return isPossiblePhoneNumber(data)
    },
    { message: "Invalid phone number" }
  )

// Required phone schema (for fields that must have a valid phone)
export const requiredPhoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .refine((data) => isPossiblePhoneNumber(data), { message: "Invalid phone number" })

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "You need to provide the current password."),
    password: z.string().min(8, "Password must be at least 8 characters.").max(128, "Password must be no more than 128 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

const baseUserFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Please enter a valid email address"),
  phone: optionalPhoneSchema,
  dob: z
    .date()
    .nullable()
    .refine((date) => !date || date.getTime() < Date.now(), {
      message: "Date of birth must be in the past.",
    }),
  image: z.url("Invalid URL").optional().or(z.literal("")),
  getMarketingEmails: z.boolean(),
  getSecurityEmails: z.boolean(),
  getOrderEmails: z.boolean(),
})

export const addUserFormSchema = z.discriminatedUnion("systemRole", [
  baseUserFormSchema.extend({
    systemRole: z.literal("admin"),
  }),
  baseUserFormSchema.extend({
    systemRole: z.literal("user"),
    // Store users can only reach the console through a store membership
    stores: z
      .array(
        z.object({
          storeId: z.string().min(1, "Store is required"),
          storeRole: z.enum(["member", "admin"] as const),
        })
      )
      .min(1, "Assign the user to at least one store"),
  }),
])

export const editAdminFormSchema = baseUserFormSchema.extend({
  id: z.string().min(1, "ID is required"),
})

export const editStoreUserFormSchema = editAdminFormSchema.extend({
  // Store users can only reach the console through a store membership
  stores: z
    .array(
      z.object({
        memberId: z.string().optional(),
        storeId: z.string().min(1, "Store is required"),
        storeRole: z.enum(ORG_ROLE_NAMES),
        isNew: z.boolean(),
      })
    )
    .min(1, "Assign the user to at least one store"),
})

export const editUserFormSchema = z.discriminatedUnion("systemRole", [editAdminFormSchema, editStoreUserFormSchema])

// Schema for adding user address
export const addAddressFormSchema = z.object({
  name: z.string().min(1, "You must provide a full name.").min(3, "Full name must be at least 3 characters."),
  phone: requiredPhoneSchema,
  line1: z.string().min(1, "You must provide a valid address."),
  line2: z.string(),
  region: z.string().min(1, "You must provide a region."),
  town: z.string().min(1, "You must provide a town."),
  latitude: z.number().min(-90, "Latitude must be at least -90").max(90, "Latitude cannot be greater than 90").nullable(),
  longitude: z.number().min(-180, "Longitude must be at least -180").max(180, "Longitude cannot be greater than 180").nullable(),
  isDefault: z.boolean(),
})

// Schema for updating user address
export const updateAddressFormSchema = addAddressFormSchema.extend({
  id: z.string().min(1, "ID is required"),
})

export const banUserFormSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  banReason: z.string().nullable(),
  banExpiresIn: z
    .date()
    .nullable()
    .refine((date) => !date || date.getTime() > Date.now(), {
      message: "Ban expiration must be in the future.",
    }),
})

export const inviteMemberFormSchema = z.object({
  email: z.email("Please enter a valid email address"),
  role: z.enum(["member", "admin"] as const),
})

// Server action inputs. Actions are public endpoints, so these check everything the forms above send,
// plus what the forms don't let you pick (IDs, the full role sets).

export const createUserActionSchema = baseUserFormSchema.extend({
  // No superAdmin: that role is granted by promoting an existing, activated user, never at creation,
  // so a mistyped email can't hand someone the top role through the set-password link
  systemRole: z.enum(["admin", "user"], "Invalid system role"),
  stores: z
    .array(
      z.object({
        storeId: z.uuid("Invalid store ID"),
        storeRole: z.enum(ORG_ROLE_NAMES),
      })
    )
    .optional(),
})

export const updateUserActionSchema = baseUserFormSchema.extend({
  id: z.uuid("Invalid user ID"),
  // Left out when the form doesn't allow changing it; changing it needs the set-email permission
  email: z.email("Please enter a valid email address").optional(),
  stores: z
    .array(
      z.object({
        memberId: z.uuid("Invalid member ID").optional(),
        storeId: z.uuid("Invalid store ID"),
        storeRole: z.enum(ORG_ROLE_NAMES),
        isNew: z.boolean(),
      })
    )
    .optional(),
  removedMembers: z
    .array(
      z.object({
        memberId: z.uuid("Invalid member ID"),
        storeId: z.uuid("Invalid store ID"),
      })
    )
    .optional(),
})

export const addAddressActionSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  data: addAddressFormSchema,
})

export const updateAddressActionSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  data: updateAddressFormSchema.extend({ id: z.uuid("Invalid address ID") }),
})
