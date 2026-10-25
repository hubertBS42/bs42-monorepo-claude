import type { Metadata } from "next"
import Link from "next/link"
import { Briefcase, Check } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { TRADE_BENEFITS } from "@/lib/trade-benefits"

export const metadata: Metadata = {
  title: "Trade accounts",
  description: "Trade prices for installers, IT contractors and resellers.",
  alternates: { canonical: "/trade" },
}

// What a trade account is, for anyone; applying is on the account's own page (Account → Trade account), through sign-in
export default function TradePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 pb-16 lg:px-6">
      <Briefcase className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">Trade accounts</h1>
      <p className="mt-3 text-muted-foreground">
        For installers, IT contractors and resellers who buy from us for their work. Apply with your company&apos;s details, and once we&apos;ve approved them you get:
      </p>
      <ul className="mt-6 space-y-3">
        {TRADE_BENEFITS.map((benefit) => (
          <li key={benefit} className="flex gap-3">
            <Check className="mt-0.5 size-5 shrink-0 text-green-600" aria-hidden />
            {benefit}
          </li>
        ))}
      </ul>
      <Button render={<Link href="/account/trade" />} size="lg" className="mt-8">
        Apply for a trade account
      </Button>
      <p className="mt-3 text-sm text-muted-foreground">You&apos;ll need to sign in or create an account first. You pay as everyone does, by mobile money or card.</p>
    </div>
  )
}
