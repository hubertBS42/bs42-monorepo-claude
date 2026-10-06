import z from "zod"

export const setupFormSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { error: "Full name must be at least two characters." })
      .max(100, { error: "Full name must be at most 100 characters." }),
    email: z.email().trim().toLowerCase(),
    password: z.string().min(8, { error: "Password must be at least 8 characters." }).max(128, { error: "Password must be at most 128 characters." }),
    confirmPassword: z
      .string()
      .min(8, { error: "Password must be at least 8 characters." })
      .max(128, { error: "Password must be at most 128 characters." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })
