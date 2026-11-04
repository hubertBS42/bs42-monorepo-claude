import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon, ChartColumn, Landmark } from "lucide-react"
import { Card, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { requireSystemPermission } from "@/lib/auth-guard"

export const metadata: Metadata = { title: "Reports" }

const reportLinks = [
  { href: "/reports/sales", icon: ChartColumn, title: "Sales", description: "Payments, refunds and what sold" },
  { href: "/reports/tax", icon: Landmark, title: "Tax", description: "Tax charged and refunded" },
]

export default async function ReportsPage() {
  await requireSystemPermission({ order: ["read"] })

  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Reports</h1>
        <p className="text-sm text-muted-foreground">Sales and tax for any range of dates.</p>
      </div>

      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {reportLinks.map((link) => {
          const Icon = link.icon
          return (
            // The title link stretches over the whole card, so the card is one click target with one accessible name
            <Card key={link.href} className="relative transition-colors hover:bg-accent/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <CardTitle className="text-base">
                  <Link href={link.href} className="after:absolute after:inset-0">
                    {link.title}
                  </Link>
                </CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
