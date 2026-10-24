import "server-only"

import { authURLs } from "@workspace/auth/constants"
import { prisma, readAppSettings, resolveDarkLogoUrl, resolveStoreName } from "@workspace/db"
import type { Prisma } from "@workspace/db/client"
import { TradeAccountStatus } from "@workspace/db/enums"
import { sendEmail, TradeAccountDecisionEmail } from "@workspace/email"

// Trade accounts' terms on the storefront: an approved account's discount, a percentage taken off its orders' goods
// before tax (as a staff discount is), and the company details its orders keep for the invoice. Suspended, pending and
// rejected accounts buy at the usual prices.

type Client = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export interface TradeTerms {
  accountId: string
  companyName: string
  tin: string
  // 0.01-99.99
  percent: Prisma.Decimal
}

// The signed-in customer's terms, or null when they have no approved trade account
export async function loadTradeTerms(client: Client, userId: string | null): Promise<TradeTerms | null> {
  if (!userId) return null
  const account = await client.tradeAccount.findUnique({ where: { userId }, select: { id: true, status: true, companyName: true, tin: true, discountPercent: true } })
  if (account?.status !== TradeAccountStatus.APPROVED || !account.discountPercent) return null
  return { accountId: account.id, companyName: account.companyName, tin: account.tin, percent: account.discountPercent }
}

// The order discount the terms give, as priceOrder and createOrder take it
export function tradeDiscount(terms: TradeTerms) {
  return { type: "PERCENTAGE" as const, value: terms.percent, reason: `Trade discount (${terms.percent.toNumber()}%)` }
}

// Tells the customer their application was approved (with the discount) or rejected (with the reason), in the
// storefront's name. Never throws: it runs after the response, where nothing could catch it.
export async function sendTradeDecisionEmail(accountId: string) {
  try {
    const [account, settings] = await Promise.all([
      prisma.tradeAccount.findUnique({
        where: { id: accountId },
        select: { companyName: true, status: true, discountPercent: true, rejectionReason: true, user: { select: { name: true, email: true } } },
      }),
      readAppSettings(),
    ])
    if (!account) return
    const decision =
      account.status === TradeAccountStatus.APPROVED && account.discountPercent
        ? { approved: true as const, percent: account.discountPercent.toNumber() }
        : account.status === TradeAccountStatus.REJECTED && account.rejectionReason
          ? { approved: false as const, reason: account.rejectionReason }
          : null
    if (!decision) return

    const appName = resolveStoreName(settings)
    await sendEmail({
      to: account.user.email,
      fromName: appName,
      subject: decision.approved ? `Your trade account is approved` : `Your trade account application`,
      reactTemplate: TradeAccountDecisionEmail({
        name: account.user.name?.split(" ")[0] || "there",
        companyName: account.companyName,
        decision,
        url: new URL("/account/trade", authURLs.store).toString(),
        appName,
        logoUrl: resolveDarkLogoUrl(settings),
      }),
    })
  } catch (error) {
    console.error(`Could not send the trade account email for ${accountId}:`, error)
  }
}
