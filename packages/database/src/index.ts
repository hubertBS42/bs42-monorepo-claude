import { AppSettingsData } from "@workspace/contracts"
import { prisma } from "./client"

export { prisma, generateUniqueSku } from "./client"
export { formatPrismaError } from "./format-prisma-error"
export { findReferencedFileUrls, sweepOrphanedFiles, type FileSweepResult } from "./file-sweep"

export const DEFAULT_APP_SETTINGS: AppSettingsData = {
  storeName: "BS42.NET",
  storeDescription: null,
  consoleName: "BS42.NET",
  consoleDescription: null,
  logoUrl: null,
  faviconUrl: null,
  taxEnabled: false,
  taxRate: 0,
  taxShipping: false,
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
        taxEnabled: row.taxEnabled,
        taxRate: row.taxRate.toNumber(),
        taxShipping: row.taxShipping,
      }
    : DEFAULT_APP_SETTINGS
}
