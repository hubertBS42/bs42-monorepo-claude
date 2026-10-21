import { z } from "zod"

// Customer accounts. Better Auth checks passwords again (8 to 128 characters, its defaults).

// Trimmed before it's checked, so a pasted space doesn't fail it
const email = z.string().trim().max(254).pipe(z.email("Enter a valid email address"))

const newPassword = z.string().min(8, "Use at least 8 characters").max(128, "Use no more than 128 characters")

function passwordsMatch(data: { password: string; confirmPassword: string }, ctx: z.RefinementCtx) {
  if (data.password !== data.confirmPassword) ctx.addIssue({ code: "custom", message: "The passwords don't match", path: ["confirmPassword"] })
}

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
})

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(200),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .superRefine(passwordsMatch)

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z.object({ password: newPassword, confirmPassword: z.string() }).superRefine(passwordsMatch)

export const findOrderSchema = z.object({
  // References are upper case (BS42-20261020-00001); customers may type them in any case
  reference: z.string().trim().toUpperCase().min(1, "Enter the order reference").max(40),
  email,
})

export type SignInValues = z.input<typeof signInSchema>
export type SignUpValues = z.input<typeof signUpSchema>
export type ForgotPasswordValues = z.input<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.input<typeof resetPasswordSchema>
export type FindOrderValues = z.input<typeof findOrderSchema>
