import "server-only"

import type { prisma } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { TradeAccountStatus } from "@workspace/db/enums"
import { nextTradeStatuses } from "@workspace/commerce/trade-account-status"

// Staff reviewing storefront customers' trade accounts: approving an application with a discount, rejecting it with
// a reason, suspending an approved account, reinstating a suspended one, and changing the discount. In its own module
// (like order-refunds.ts) so it can be tested against the database without a session.

type Client = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export type TradeReviewErrorCode = "NOT_FOUND" | "STATUS_CHANGED" | "INVALID_TRANSITION"

export class TradeReviewError extends Error {
  readonly code: TradeReviewErrorCode

  constructor(code: TradeReviewErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export interface TradeReview {
  accountId: string
  // The status the page showed: nothing changes if someone else reviewed it since
  from: TradeAccountStatus
  to: TradeAccountStatus
  // For APPROVED: the discount, a percentage (a reinstatement or a change keeps or replaces the current one)
  percent: Prisma.Decimal | null
  // For REJECTED: shown to the customer
  reason: string | null
  reviewedById: string
}

// Returns whether the customer is emailed about it: an application approved or rejected
export async function reviewTradeAccount(client: Client, { accountId, from, to, percent, reason, reviewedById }: TradeReview) {
  if (!nextTradeStatuses(from).includes(to)) throw new TradeReviewError("INVALID_TRANSITION", "The account can't move to that status from where it is.")
  if (to === TradeAccountStatus.APPROVED && !percent) throw new TradeReviewError("INVALID_TRANSITION", "Set the discount to approve the account.")
  if (to === TradeAccountStatus.REJECTED && !reason) throw new TradeReviewError("INVALID_TRANSITION", "Give the reason, which the customer is shown.")

  const data: Prisma.TradeAccountUncheckedUpdateManyInput = {
    status: to,
    reviewedById,
    reviewedAt: new Date(),
    ...(to === TradeAccountStatus.APPROVED && { discountPercent: percent }),
    ...(to === TradeAccountStatus.REJECTED && { rejectionReason: reason }),
  }
  // Only from the status the page showed, so two people can't both decide
  const { count } = await client.tradeAccount.updateMany({ where: { id: accountId, status: from }, data })
  if (count === 0) {
    const exists = await client.tradeAccount.findUnique({ where: { id: accountId }, select: { id: true } })
    throw exists
      ? new TradeReviewError("STATUS_CHANGED", "Someone else changed this trade account since the page loaded. Refresh the page to see it.")
      : new TradeReviewError("NOT_FOUND", "Trade account not found.")
  }
  return from === TradeAccountStatus.PENDING
}
