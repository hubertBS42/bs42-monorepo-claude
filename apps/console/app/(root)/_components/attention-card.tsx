import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

export interface AttentionItem {
  label: string
  hint: string
  count: number
  // The list filtered to these; without one the row is plain text
  href?: string
  // Shown in red while there are any, for what's holding up money or sales
  urgent?: boolean
}

export default function AttentionCard({ items }: { items: AttentionItem[] }) {
  const waiting = items.some((item) => item.count > 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>{waiting ? "Orders and stock waiting on someone." : "Nothing is waiting on anyone right now."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1">
        {items.map((item) => {
          const content = (
            <>
              <div className="grid min-w-0 flex-1">
                <span className={item.count ? "text-sm font-medium" : "text-sm text-muted-foreground"}>{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.hint}</span>
              </div>
              <Badge variant={item.count === 0 ? "outline" : item.urgent ? "destructive" : "secondary"} className="tabular-nums">
                {item.count}
              </Badge>
            </>
          )
          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {content}
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          ) : (
            <div key={item.label} className="flex items-center gap-3 py-2">
              {content}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
