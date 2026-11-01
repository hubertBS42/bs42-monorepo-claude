// The shape of seed-config.json, written by export-config.ts and read by seed-config.ts. Decimals are strings, so they
// reach the Decimal columns exactly, and dates ISO strings.
import type { AppSettings, InstallationOption } from "../generated/prisma/client"

export type SeedConfig = {
  appSettings: (Omit<AppSettings, "id" | "updatedAt" | "taxRate" | "exchangeRateMarkupPercent"> & { taxRate: string; exchangeRateMarkupPercent: string }) | null
  delivery: { freeDeliveryFromGhs: string | null; rates: { region: string; town: string | null; feeGhs: string }[] }
  installationAreas: { region: string; town: string | null }[]
  legalPages: { termsOfService: string | null; termsUpdatedAt: string | null; privacyPolicy: string | null; privacyUpdatedAt: string | null } | null
  // `path` is the category's name and those above it, top first
  categories: { path: string[]; image: string | null; isFeatured: boolean; installationFeeGhs: string | null }[]
  brands: { name: string; logo: string | null; description: string | null; isFeatured: boolean }[]
  products: { name: string; installation: InstallationOption; installationFeeGhs: string | null }[]
}
