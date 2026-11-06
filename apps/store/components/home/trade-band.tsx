import Link from "next/link"
import { Briefcase, Check } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { TRADE_BENEFITS } from "@/lib/trade-benefits"

// The homepage's word to businesses (hotels, offices, installers), who buy most of what the store sells
export function TradeBand() {
  return (
    <div className="grid gap-6 rounded-xl bg-muted p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
      <div>
        <Briefcase className="size-8 text-primary" aria-hidden />
        <h2 className="mt-3 text-xl font-bold md:text-2xl">Buying for a hotel, office or install job?</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Open a trade account for your business:</p>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {TRADE_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
              {benefit}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-3 md:flex-col">
        <Button render={<Link href="/account/trade" />} size="lg">
          Apply for a trade account
        </Button>
        <Button render={<Link href="/trade" />} variant="outline" size="lg">
          About trade accounts
        </Button>
      </div>
    </div>
  )
}
