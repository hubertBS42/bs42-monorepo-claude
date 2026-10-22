import "server-only"

import type { prisma } from "@workspace/db"
import { TradeAccountStatus } from "@workspace/db/enums"
import type { z } from "zod"

import type { tradeApplicationSchema } from "./schemas/trade.schemas"

// Applying for a trade account. One per customer account: a business applies, the platform's staff approve it with a
// discount (or reject it with a reason, after which it can apply again with corrected details). In its own module, with
// relative imports, so it can be tested against the database without a request.

type Client = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export class TradeApplicationError extends Error {
  readonly code = "ALREADY_APPLIED"

  constructor() {
    super("You've already applied for a trade account.")
  }
}

// Saves the application as pending, a new one or a rejected one sent again. Returns its id, for the staff email.
export async function applyForTradeAccount(client: Client, userId: string, values: z.output<typeof tradeApplicationSchema>) {
  const details = { ...values, details: values.details || null }
  const existing = await client.tradeAccount.findUnique({ where: { userId }, select: { id: true, status: true } })
  if (!existing) return (await client.tradeAccount.create({ data: { userId, ...details }, select: { id: true } })).id

  // Only from rejected, so two submits (or one after an approval) can't reopen an account
  const { count } = await client.tradeAccount.updateMany({
    where: { id: existing.id, status: TradeAccountStatus.REJECTED },
    data: { ...details, status: TradeAccountStatus.PENDING, rejectionReason: null, reviewedById: null, reviewedAt: null },
  })
  if (count === 0) throw new TradeApplicationError()
  return existing.id
}
