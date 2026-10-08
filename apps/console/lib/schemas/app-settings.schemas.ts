import z from "zod"

export const appSettingsSchema = z.object({
  storeName: z.string().trim().min(1, "Store name is required").max(60),
  storeDescription: z.string().trim().max(160),
  consoleName: z.string().trim().max(60),
  consoleDescription: z.string().trim().max(160),
  logoUrl: z.url().or(z.literal("")),
  faviconUrl: z.url().or(z.literal("")),
})
