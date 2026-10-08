import { AppSettingsData } from "@workspace/contracts"
import { prisma } from "./client"

export { prisma } from "./client"
export { formatPrismaError } from "./format-prisma-error"

export const DEFAULT_APP_SETTINGS: AppSettingsData = {
  storeName: "BS42.NET",
  storeDescription: null,
  consoleName: "BS42.NET",
  consoleDescription: null,
  logoUrl: null,
  faviconUrl: null,
}

export const resolveConsoleName = (s: AppSettingsData) => s.consoleName ?? s.storeName
export const resolveStoreName = (s: AppSettingsData) => s.storeName

export async function readAppSettings(): Promise<AppSettingsData> {
  const row = await prisma.appSettings.findUnique({ where: { id: "singleton" } })
  return row
    ? {
        storeName: row.storeName,
        storeDescription: row.storeDescription,
        consoleName: row.consoleName,
        consoleDescription: row.consoleDescription,
        logoUrl: row.logoUrl,
        faviconUrl: row.faviconUrl,
      }
    : DEFAULT_APP_SETTINGS
}
