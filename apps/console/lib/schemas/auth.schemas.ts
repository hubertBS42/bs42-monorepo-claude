import z from "zod"

export const signInFormSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export const resetPasswordSchema = z.object({
  email: z.email("Enter a valid email address."),
})

export const setPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters.").max(128, "Password must be no more than 128 characters."),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters."),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      })
    }
  })
