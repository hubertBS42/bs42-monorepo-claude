"use server"

import type { ActionResponse } from "@workspace/contracts"
import { DEFAULT_APP_SETTINGS, prisma, toAppSettingsData } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { isManagedFileUrl, removeFiles } from "@workspace/storage"
import { updateTag } from "next/cache"
import { requireSystemPermission } from "../auth-guard"
import { settingsSectionSchemas, type SectionInput, type SectionOutput, type SettingsSection } from "../schemas/app-settings.schemas"
import { sameSectionValues, sectionValues } from "../settings-sections"

type ErrorResponse = Exclude<ActionResponse, { success: true }>

const CONFLICT: ErrorResponse = {
  success: false,
  error: "Someone else changed these settings since you opened this page. It now shows their changes: make yours again.",
  code: "CONFLICT",
}

// The row's columns for one card's values. The forms work with plain strings, and empty values are stored as null.
function toData(section: SettingsSection, values: SectionOutput<SettingsSection>): Prisma.AppSettingsUpdateInput {
  switch (section) {
    case "storefront": {
      const { storeName, storeDescription } = values as SectionOutput<"storefront">
      return { storeName, storeDescription: storeDescription || null }
    }
    case "console": {
      const { consoleName, consoleDescription } = values as SectionOutput<"console">
      return { consoleName: consoleName || null, consoleDescription: consoleDescription || null }
    }
    case "branding": {
      const { logoUrl, faviconUrl } = values as SectionOutput<"branding">
      return { logoUrl: logoUrl || null, faviconUrl: faviconUrl || null }
    }
    case "tax": {
      const { taxEnabled, taxRatePercent, taxShipping } = values as SectionOutput<"tax">
      // Decimal arithmetic, so 15% is stored as exactly 0.15. Turning tax off keeps the rate for next time.
      return { taxEnabled, taxShipping, taxRate: new Prisma.Decimal(taxRatePercent === "" ? 0 : taxRatePercent).div(100) }
    }
    case "markup":
      return { exchangeRateMarkupPercent: new Prisma.Decimal((values as SectionOutput<"markup">).exchangeRateMarkupPercent.toFixed(2)) }
    case "quotations":
      return { quoteValidityDays: (values as SectionOutput<"quotations">).quoteValidityDays }
    case "notifications": {
      const notifications = values as SectionOutput<"notifications">
      // Lowercased by the schema, so "A@x.com" and "a@x.com" are one address
      return { ...notifications, notificationEmails: [...new Set(notifications.notificationEmails)] }
    }
  }
}

// Saves one settings card. `original` is what the card loaded (sectionValues): the save is refused when those fields
// have changed since (CONFLICT), so it can't undo someone else's save, while other cards' fields are left alone.
export async function saveSettingsSection<S extends SettingsSection>(section: S, values: SectionInput<S>, original: SectionInput<S>): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ appSettings: ["update"] })

  if (!Object.hasOwn(settingsSectionSchemas, section)) return { success: false, error: "Unknown settings", code: "INVALID" }
  const parsed = settingsSectionSchemas[section].safeParse(values)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid settings", code: "INVALID" }
  const data = toData(section, parsed.data)

  try {
    // Images are uploaded by the browser beforehand, so these are the final URLs; only blobs in our own container
    if (section === "branding" && [data.logoUrl, data.faviconUrl].some((url) => typeof url === "string" && !isManagedFileUrl(url))) {
      return { success: false, error: "Invalid file URL", code: "INVALID_FILE" }
    }

    const previous = await prisma.$transaction(async (tx) => {
      // Locked, so no save slips in between the check and the write
      await tx.$queryRaw`SELECT 1 FROM "app_settings" WHERE "id" = 'singleton' FOR UPDATE`
      const row = await tx.appSettings.findUnique({ where: { id: "singleton" } })
      const current = row ? toAppSettingsData(row) : DEFAULT_APP_SETTINGS
      if (!sameSectionValues(sectionValues(current, section), original)) return null

      if (row) await tx.appSettings.update({ where: { id: "singleton" }, data })
      // The first save creates the row; the other columns take their defaults, as readAppSettings assumes
      else await tx.appSettings.create({ data: { id: "singleton", storeName: DEFAULT_APP_SETTINGS.storeName, ...data } as Prisma.AppSettingsCreateInput })
      return current
    })
    if (!previous) return CONFLICT

    // Only the server knows the previous values, so it removes the replaced files once the save has committed
    if (section === "branding") {
      await removeFiles([previous.logoUrl !== data.logoUrl ? previous.logoUrl : null, previous.faviconUrl !== data.faviconUrl ? previous.faviconUrl : null])
    }

    // Next 16: updateTag("app-settings") for read-your-writes
    updateTag("app-settings")
    return { success: true }
  } catch (error) {
    // Two first saves at once: the second create hits the primary key
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return CONFLICT
    console.error("Saving app settings failed:", error)
    return { success: false, error: "Could not save the settings. Please try again.", code: "FAILED" }
  }
}
