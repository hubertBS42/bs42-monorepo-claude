import type { Metadata } from "next"
import { Info } from "lucide-react"
import { BUSINESS_TYPE_LABELS } from "@workspace/commerce/trade-account-status"
import { prisma } from "@workspace/db"
import { TradeAccountStatus } from "@workspace/db/enums"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { TradeApplicationForm } from "@/components/account/trade-application-form"
import { requireCustomer } from "@/lib/session"
import { TRADE_BENEFITS } from "@/lib/trade-benefits"

export const metadata: Metadata = { title: "Trade account", robots: { index: false } }

function Details({ account }: { account: { companyName: string; registrationNumber: string; tin: string; phone: string; businessType: keyof typeof BUSINESS_TYPE_LABELS } }) {
  const rows = [
    ["Company", account.companyName],
    ["Registration number", account.registrationNumber],
    ["TIN", account.tin],
    ["Phone", account.phone],
    ["Business", BUSINESS_TYPE_LABELS[account.businessType]],
  ]
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default async function TradeAccountPage() {
  const session = await requireCustomer("/account/trade")
  const account = await prisma.tradeAccount.findUnique({ where: { userId: session.user.id } })

  if (!account || account.status === TradeAccountStatus.REJECTED) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade account</CardTitle>
          <CardDescription>For installers, IT contractors and resellers. Once we&apos;ve approved your business, you get:</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {TRADE_BENEFITS.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
          {account?.rejectionReason && (
            <p className="flex gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>We couldn&apos;t approve your last application: {account.rejectionReason} You&apos;re welcome to apply again.</span>
            </p>
          )}
          <TradeApplicationForm
            initial={{
              companyName: account?.companyName ?? "",
              registrationNumber: account?.registrationNumber ?? "",
              tin: account?.tin ?? "",
              phone: account?.phone ?? "",
              businessType: account?.businessType ?? "",
              details: account?.details ?? "",
            }}
          />
        </CardContent>
      </Card>
    )
  }

  const description =
    account.status === TradeAccountStatus.PENDING
      ? "We're reviewing your application and will email you once we have. It usually takes a working day or two."
      : account.status === TradeAccountStatus.APPROVED
        ? `You get ${Number(account.discountPercent)}% off everything, before tax, and the shop shows your prices.`
        : "Your trade account is suspended, so you're paying our usual prices for now. Get in touch with us to sort it out."

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Trade account
          <Badge variant={account.status === TradeAccountStatus.APPROVED ? "default" : "secondary"}>
            {account.status === TradeAccountStatus.PENDING ? "Under review" : account.status === TradeAccountStatus.APPROVED ? "Approved" : "Suspended"}
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Details account={account} />
        <p className="text-sm text-muted-foreground">To change these details, get in touch with us.</p>
      </CardContent>
    </Card>
  )
}
