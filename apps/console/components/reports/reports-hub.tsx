import Link from "next/link"
import { ArrowRightIcon, ChartColumn, Landmark, Package, Truck, Undo2, type LucideIcon } from "lucide-react"
import { Card, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

const REPORTS: Record<"sales" | "tax" | "refunds" | "stock" | "purchases", { icon: LucideIcon; title: string; description: string }> = {
  sales: { icon: ChartColumn, title: "Sales", description: "Payments, refunds and what sold" },
  tax: { icon: Landmark, title: "Tax", description: "Tax charged and refunded" },
  refunds: { icon: Undo2, title: "Refunds & Returns", description: "Money given back and items brought back" },
  stock: { icon: Package, title: "Stock Value", description: "What's on the shelves, at cost and price" },
  purchases: { icon: Truck, title: "Purchases", description: "What was bought from each supplier" },
}

interface ReportsHubProps {
  description: string
  // Where each report is, in the order shown
  reports: { report: keyof typeof REPORTS; href: string }[]
}

// The Reports page in either workspace: a card per report
export default function ReportsHub({ description, reports }: ReportsHubProps) {
  return (
    <div className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Reports</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {reports.map(({ report, href }) => {
          const { icon: Icon, title, description } = REPORTS[report]
          return (
            // The title link stretches over the whole card, so the card is one click target with one accessible name
            <Card key={href} className="relative transition-colors hover:bg-accent/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <CardTitle className="text-base">
                  <Link href={href} className="after:absolute after:inset-0">
                    {title}
                  </Link>
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
