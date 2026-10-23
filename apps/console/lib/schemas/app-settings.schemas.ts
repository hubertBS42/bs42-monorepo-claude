import z from "zod"

// Settings is split into cards across its pages (General, Pricing, Notifications, ...), and each card saves only its
// own fields of the AppSettings row (saveSettingsSection), so one card can't undo another's save

// A percentage (15 = 15%), stored as a fraction. "" is an emptied number field.
const taxSchema = z
  .object({
    taxEnabled: z.boolean(),
    taxRatePercent: z.number().or(z.literal("")),
    taxShipping: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const rate = data.taxRatePercent
    if (rate === "") {
      if (data.taxEnabled) ctx.addIssue({ code: "custom", path: ["taxRatePercent"], message: "Enter the tax rate." })
      return
    }
    if (rate < 0 || rate > 100) ctx.addIssue({ code: "custom", path: ["taxRatePercent"], message: "The tax rate must be between 0 and 100%." })
    else if (data.taxEnabled && rate === 0) ctx.addIssue({ code: "custom", path: ["taxRatePercent"], message: "Enter a rate above 0%, or turn tax off." })
    // The column holds a fraction with 4 decimals, so the percentage can have 2
    else if (Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-9) ctx.addIssue({ code: "custom", path: ["taxRatePercent"], message: "Use at most 2 decimal places." })
  })

export const settingsSectionSchemas = {
  storefront: z.object({
    storeName: z.string().trim().min(1, "Store name is required").max(60),
    storeDescription: z.string().trim().max(160),
  }),
  console: z.object({
    consoleName: z.string().trim().max(60),
    consoleDescription: z.string().trim().max(160),
  }),
  branding: z.object({
    logoUrl: z.httpUrl().or(z.literal("")),
    faviconUrl: z.httpUrl().or(z.literal("")),
  }),
  tax: taxSchema,
  markup: z.object({
    // A percentage; 0 for none
    exchangeRateMarkupPercent: z
      .number("Enter a percentage")
      .min(0, "At least 0%")
      .max(10, "At most 10%")
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, "Use at most 2 decimal places"),
  }),
  quotations: z.object({
    quoteValidityDays: z.number("Enter a number of days").int("Use whole days").min(1, "At least 1 day").max(90, "At most 90 days"),
  }),
  notifications: z.object({
    // Reported on the field as a whole: the tags input shows the field's error, not each tag's
    notificationEmails: z
      .array(z.string().trim().toLowerCase())
      .max(10, "Add up to 10 addresses.")
      .superRefine((emails, ctx) => {
        const invalid = emails.find((email) => !z.email().safeParse(email).success)
        if (invalid) ctx.addIssue({ code: "custom", message: `"${invalid}" isn't a valid email address.` })
      }),
    notifyStorefrontOrders: z.boolean(),
    notifyStaffOrders: z.boolean(),
    notifyLowStock: z.boolean(),
    notifyOutOfStock: z.boolean(),
    notifyRateFetchFailure: z.boolean(),
    notifyStoreRefunds: z.boolean(),
    notifyLowRatings: z.boolean(),
    notifyTradeApplications: z.boolean(),
    notifyQuotes: z.boolean(),
  }),
}

export type SettingsSection = keyof typeof settingsSectionSchemas
export type SectionInput<S extends SettingsSection> = z.input<(typeof settingsSectionSchemas)[S]>
export type SectionOutput<S extends SettingsSection> = z.output<(typeof settingsSectionSchemas)[S]>
