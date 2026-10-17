import z from "zod"

// GHS per 1 USD, stored with 6 decimal places
export const exchangeRateFormSchema = z.object({
  rate: z
    .number("Enter the rate")
    .positive("The rate must be above 0")
    .max(1000, "That rate looks wrong: it's GHS per 1 USD")
    .refine((value) => Math.abs(Math.round(value * 1e6) - value * 1e6) < 1e-3, { message: "Use at most 6 decimal places" }),
})
