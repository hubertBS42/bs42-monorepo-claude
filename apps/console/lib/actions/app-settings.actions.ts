"use server"

import type { ActionResponse } from "@workspace/contracts"
import { prisma, readAppSettings } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { isManagedFileUrl, removeFiles } from "@workspace/storage"
import { updateTag } from "next/cache"
import { requireSystemPermission } from "../auth-guard"
import { appSettingsSchema } from "../schemas/app-settings.schemas"

/**
 * Receives plain values. Images are uploaded by the client beforehand
 * (uploadImages -> /api/storage/images), so logoUrl and faviconUrl are the
 * final values: the current URL if unchanged, a new URL if replaced, or null
 * if removed.
 */
type ErrorResponse = Exclude<ActionResponse, { success: true }>

// version is the saved row's new version, which the form needs for its next save
type SaveAppSettingsResponse = { success: true; version: string } | ErrorResponse

const CONFLICT: ErrorResponse = {
  success: false,
  error: "The settings were changed by someone else since you opened this page. Reload to see their changes, then try again.",
  code: "CONFLICT",
}

export async function saveAppSettings(input: unknown): Promise<SaveAppSettingsResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ appSettings: ["update"] })

  const parsed = appSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid settings", code: "INVALID" }
  }

  const { taxRatePercent, version, ...fields } = parsed.data

  // The form works with plain strings; empty values are stored as null
  const data = {
    ...fields,
    // Decimal arithmetic, so 15% is stored as exactly 0.15. Turning tax off keeps the rate for next time.
    taxRate: new Prisma.Decimal(taxRatePercent === "" ? 0 : taxRatePercent).div(100),
    exchangeRateMarkupPercent: new Prisma.Decimal(parsed.data.exchangeRateMarkupPercent.toFixed(2)),
    storeDescription: parsed.data.storeDescription || null,
    consoleName: parsed.data.consoleName || null,
    consoleDescription: parsed.data.consoleDescription || null,
    logoUrl: parsed.data.logoUrl || null,
    faviconUrl: parsed.data.faviconUrl || null,
    // Lowercased by the schema, so "A@x.com" and "a@x.com" are one address
    notificationEmails: [...new Set(parsed.data.notificationEmails)],
  }
  const { logoUrl, faviconUrl } = data

  try {
    // The client could send any URL, so only accept blobs in our own container
    if ([logoUrl, faviconUrl].some((url) => url !== null && !isManagedFileUrl(url))) {
      return { success: false, error: "Invalid file URL", code: "INVALID_FILE" }
    }

    const previous = await readAppSettings()

    // Save only if nobody has saved since the form was opened. One statement, so no save can slip in between, and
    // it returns the new version too. No matching row means someone else saved first (P2025).
    let saved: { updatedAt: Date }
    if (version) {
      try {
        saved = await prisma.appSettings.update({ where: { id: "singleton", updatedAt: new Date(version) }, data, select: { updatedAt: true } })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return CONFLICT
        throw error
      }
    } else {
      // No row when the form was opened: the first save creates it, and a second first save hits the primary key
      const existing = await prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { id: true } })
      if (existing) return CONFLICT
      saved = await prisma.appSettings.create({ data: { id: "singleton", ...data }, select: { updatedAt: true } })
    }

    // Only the server knows the previous values, so it removes the replaced files
    await removeFiles([previous.logoUrl !== logoUrl ? previous.logoUrl : null, previous.faviconUrl !== faviconUrl ? previous.faviconUrl : null])

    // Next 16: revalidateTag("app-settings", "max"), or updateTag("app-settings") for read-your-writes
    updateTag("app-settings")
    return { success: true, version: saved.updatedAt.toISOString() }
  } catch (error) {
    // Two first saves at once: the second create hits the primary key
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return CONFLICT
    console.error("Saving app settings failed:", error)
    return { success: false, error: "Could not save the settings. Please try again.", code: "FAILED" }
  }
}
