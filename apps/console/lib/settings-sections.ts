import type { AppSettingsData } from "@workspace/contracts"
import type { SectionInput, SettingsSection } from "@/lib/schemas/app-settings.schemas"

// Each settings card's form values, from the saved settings. The card starts from them and sends them back with its
// save as what it loaded, and saveSettingsSection compares them with the row as it is now, so a card opened before
// someone else saved the same fields can't undo their change. Plain module: the cards and the action both use it.
export function sectionValues<S extends SettingsSection>(settings: AppSettingsData, section: S): SectionInput<S> {
  const values: { [K in SettingsSection]: SectionInput<K> } = {
    storefront: { storeName: settings.storeName, storeDescription: settings.storeDescription ?? "" },
    console: { consoleName: settings.consoleName ?? "", consoleDescription: settings.consoleDescription ?? "" },
    branding: { logoUrl: settings.logoUrl ?? "", logoDarkUrl: settings.logoDarkUrl ?? "", faviconUrl: settings.faviconUrl ?? "" },
    tax: {
      taxEnabled: settings.taxEnabled,
      // Rounded, because a fraction times 100 can come out as 15.000000000000002
      taxRatePercent: Math.round(settings.taxRate * 10000) / 100,
      taxShipping: settings.taxShipping,
    },
    markup: { exchangeRateMarkupPercent: settings.exchangeRateMarkupPercent },
    quotations: { quoteValidityDays: settings.quoteValidityDays },
    bankTransfer: { bankTransferDetails: settings.bankTransferDetails ?? "" },
    notifications: {
      notificationEmails: settings.notificationEmails,
      notifyStorefrontOrders: settings.notifyStorefrontOrders,
      notifyStaffOrders: settings.notifyStaffOrders,
      notifyLowStock: settings.notifyLowStock,
      notifyOutOfStock: settings.notifyOutOfStock,
      notifyRateFetchFailure: settings.notifyRateFetchFailure,
      notifyStoreRefunds: settings.notifyStoreRefunds,
      notifyLowRatings: settings.notifyLowRatings,
      notifyTradeApplications: settings.notifyTradeApplications,
      notifyQuotes: settings.notifyQuotes,
      notifyProductRequests: settings.notifyProductRequests,
    },
  }
  return values[section]
}

// Whether two sets of a card's values are the same, whatever order their keys came in
export function sameSectionValues(a: object, b: object) {
  const sorted = (value: object) => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([x], [y]) => (x < y ? -1 : 1))))
  return sorted(a) === sorted(b)
}
