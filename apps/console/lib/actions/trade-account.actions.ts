"use server"

import { after } from "next/server"
import { z } from "zod"
import { formatError } from "@workspace/auth/format-error"
import { sendTradeDecisionEmail } from "@workspace/commerce/trade-accounts"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"
import { Prisma } from "@workspace/db/client"
import { requireSystemPermission } from "@/lib/auth-guard"
import { reviewTradeAccountSchema } from "@/lib/schemas/trade-account.schemas"
import { reviewTradeAccount, TradeReviewError } from "@/lib/trade-account-reviews"

// Every export here is a public endpoint, so every input is validated

// Approves, rejects, suspends or reinstates a trade account, or changes its discount. The customer is emailed when
// their application is approved or rejected.
export async function reviewTradeAccountAction(input: z.input<typeof reviewTradeAccountSchema>): Promise<ActionResponse> {
  const session = await requireSystemPermission({ tradeAccount: ["update"] })

  try {
    const parsed = reviewTradeAccountSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "INVALID" }
    const { accountId, currentStatus, status, percent, reason } = parsed.data

    const decided = await reviewTradeAccount(prisma, {
      accountId,
      from: currentStatus,
      to: status,
      percent: percent === "" ? null : new Prisma.Decimal(percent.toFixed(2)),
      reason: reason || null,
      reviewedById: session.user.id,
    })
    // Only once it's saved: after() also runs when an action fails
    if (decided) after(() => sendTradeDecisionEmail(accountId))
    return { success: true }
  } catch (error) {
    if (error instanceof TradeReviewError) return { success: false, error: error.message, code: error.code }
    return { success: false, error: formatError(error) }
  }
}
