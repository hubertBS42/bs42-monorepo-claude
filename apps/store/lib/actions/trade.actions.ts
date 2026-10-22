"use server"

import { after } from "next/server"
import { Prisma } from "@workspace/db/client"
import { notifyTradeApplication } from "@workspace/commerce/notifications"
import type { ActionResponse } from "@workspace/contracts"
import { prisma } from "@workspace/db"

import { tradeApplicationSchema, type TradeApplicationValues } from "@/lib/schemas/trade.schemas"
import { getStoreSession } from "@/lib/session"
import { applyForTradeAccount, TradeApplicationError } from "@/lib/trade-account"

const SIGNED_OUT = { success: false as const, error: "Your session has ended. Sign in again to apply.", code: "UNAUTHORIZED" }

// A business applying for a trade account, or applying again after a rejection. Staff hear of it once it's saved.
export async function applyForTradeAccountAction(input: TradeApplicationValues): Promise<ActionResponse> {
  const session = await getStoreSession()
  if (!session) return SIGNED_OUT

  const parsed = tradeApplicationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the details.", code: "INVALID_INPUT" }

  try {
    const accountId = await applyForTradeAccount(prisma, session.user.id, parsed.data)
    after(() => notifyTradeApplication(accountId))
    return { success: true }
  } catch (error) {
    if (error instanceof TradeApplicationError) return { success: false, error: error.message, code: error.code }
    // Two first applications at once: the second finds the first's row
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { success: false, error: new TradeApplicationError().message, code: "ALREADY_APPLIED" }
    console.error("Could not save a trade account application:", error)
    return { success: false, error: "We couldn't send that just now. Please try again." }
  }
}
