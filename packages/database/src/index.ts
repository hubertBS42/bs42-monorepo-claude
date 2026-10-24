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
  logoDarkUrl: null,
  faviconUrl: null,
  contactPhone: null,
  contactWhatsapp: null,
  contactEmail: null,
  contactAddress: null,
  taxEnabled: false,
  taxRate: 0,
  taxShipping: false,
  notificationEmails: [],
  notifyStorefrontOrders: true,
  notifyStaffOrders: false,
  notifyLowStock: true,
  notifyOutOfStock: true,
  notifyRateFetchFailure: true,
  notifyStoreRefunds: true,
  notifyLowRatings: false,
  notifyTradeApplications: true,
  notifyQuotes: false,
  notifyProductRequests: true,
  quoteValidityDays: 7,
  bankTransferDetails: null,
  exchangeRateMarkupPercent: 0,
}

export const resolveConsoleName = (s: AppSettingsData) => s.consoleName ?? s.storeName
export const resolveStoreName = (s: AppSettingsData) => s.storeName
// The logo for a dark background, such as the emails' header
export const resolveDarkLogoUrl = (s: AppSettingsData) => s.logoDarkUrl ?? s.logoUrl

type AppSettingsRow = NonNullable<Awaited<ReturnType<typeof prisma.appSettings.findUnique>>>

// The row as plain values that can reach client components (decimals as numbers)
export function toAppSettingsData(row: AppSettingsRow): AppSettingsData {
  return {
    storeName: row.storeName,
    storeDescription: row.storeDescription,
    consoleName: row.consoleName,
    consoleDescription: row.consoleDescription,
    logoUrl: row.logoUrl,
    logoDarkUrl: row.logoDarkUrl,
    faviconUrl: row.faviconUrl,
    contactPhone: row.contactPhone,
    contactWhatsapp: row.contactWhatsapp,
    contactEmail: row.contactEmail,
    contactAddress: row.contactAddress,
    taxEnabled: row.taxEnabled,
    taxRate: row.taxRate.toNumber(),
    taxShipping: row.taxShipping,
    notificationEmails: row.notificationEmails,
    notifyStorefrontOrders: row.notifyStorefrontOrders,
    notifyStaffOrders: row.notifyStaffOrders,
    notifyLowStock: row.notifyLowStock,
    notifyOutOfStock: row.notifyOutOfStock,
    notifyRateFetchFailure: row.notifyRateFetchFailure,
    notifyStoreRefunds: row.notifyStoreRefunds,
    notifyLowRatings: row.notifyLowRatings,
    notifyTradeApplications: row.notifyTradeApplications,
    notifyQuotes: row.notifyQuotes,
    notifyProductRequests: row.notifyProductRequests,
    quoteValidityDays: row.quoteValidityDays,
    bankTransferDetails: row.bankTransferDetails,
    exchangeRateMarkupPercent: row.exchangeRateMarkupPercent.toNumber(),
  }
}

export async function readAppSettings(): Promise<AppSettingsData> {
  const row = await prisma.appSettings.findUnique({ where: { id: "singleton" } })
  return row ? toAppSettingsData(row) : DEFAULT_APP_SETTINGS
}
