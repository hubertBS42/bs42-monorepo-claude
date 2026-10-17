import z from "zod"

export const inviteSchema = z.object({
  email: z.email(),
  // Owners are superAdmins, who are already members of every store
  role: z.enum(["member", "admin"]),
})

// The store comes from the page, so an invite can't land in a store the user switched to in another tab
export const inviteMemberSchema = inviteSchema.extend({
  storeId: z.uuid("Invalid store ID"),
})

export const invitedSignUpFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    password: z.string().min(8, "Password must be at least 8 characters.").max(128, "Password must be no more than 128 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })
