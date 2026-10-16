"use server"

import { ActionResponse } from "@workspace/contracts"
import { prisma, readAppSettings } from "@workspace/db"
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
export async function saveAppSettings(input: unknown): Promise<ActionResponse> {
  // Outside the try block: redirect() works by throwing and must not be caught
  await requireSystemPermission({ appSettings: ["update"] })

  const parsed = appSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid settings", code: "INVALID" }
  }

  // The form works with plain strings; empty values are stored as null
  const data = {
    ...parsed.data,
    storeDescription: parsed.data.storeDescription || null,
    consoleName: parsed.data.consoleName || null,
    consoleDescription: parsed.data.consoleDescription || null,
    logoUrl: parsed.data.logoUrl || null,
    faviconUrl: parsed.data.faviconUrl || null,
  }
  const { logoUrl, faviconUrl } = data

  try {
    // The client could send any URL, so only accept blobs in our own container
    if ([logoUrl, faviconUrl].some((url) => url !== null && !isManagedFileUrl(url))) {
      return { success: false, error: "Invalid file URL", code: "INVALID_FILE" }
    }

    const previous = await readAppSettings()

    await prisma.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    // Only the server knows the previous values, so it removes the replaced files
    await removeFiles([previous.logoUrl !== logoUrl ? previous.logoUrl : null, previous.faviconUrl !== faviconUrl ? previous.faviconUrl : null])

    // Next 16: revalidateTag("app-settings", "max"), or updateTag("app-settings") for read-your-writes
    updateTag("app-settings")
    return { success: true }
  } catch (error) {
    console.error("Saving app settings failed:", error)
    return { success: false, error: "Could not save the settings. Please try again.", code: "FAILED" }
  }
}
