import { BusinessType, TradeAccountStatus } from "@workspace/db/enums"

// Trade accounts' labels, with no Prisma values, so client components can use them

export const TRADE_ACCOUNT_STATUS_LABELS: Record<TradeAccountStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
}

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  INSTALLER: "Installer",
  IT_CONTRACTOR: "IT contractor",
  RESELLER: "Reseller",
  OTHER: "Other",
}

export const BUSINESS_TYPE_OPTIONS = Object.values(BusinessType).map((value) => ({ value, label: BUSINESS_TYPE_LABELS[value] }))

// An application is open (it can't be sent again) unless it was rejected
export const canApplyAgain = (status: TradeAccountStatus) => status === TradeAccountStatus.REJECTED

// Where staff can take an account from where it is. Approved stays approved when its discount changes; a rejected
// application waits for the customer to apply again.
export function nextTradeStatuses(status: TradeAccountStatus): TradeAccountStatus[] {
  switch (status) {
    case TradeAccountStatus.PENDING:
      return [TradeAccountStatus.APPROVED, TradeAccountStatus.REJECTED]
    case TradeAccountStatus.APPROVED:
      return [TradeAccountStatus.APPROVED, TradeAccountStatus.SUSPENDED]
    case TradeAccountStatus.SUSPENDED:
      return [TradeAccountStatus.APPROVED]
    case TradeAccountStatus.REJECTED:
      return []
  }
}
