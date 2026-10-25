import Link from "next/link"
import { CircleCheck, ChevronRight } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"

export interface AttentionItem {
  label: string
  hint: string
  count: number
  // The list filtered to these; without one the row is plain text
  href?: string
  // href is in another workspace (?workspace=): a full page load, so the sidebar follows the switch
  switchesWorkspace?: boolean
  // Shown in red while there are any, for what's holding up money or sales
  urgent?: boolean
}

// Only the rows with something waiting, so the card reads as a to-do list; each one's list is in the sidebar too
export default function AttentionCard({ items }: { items: AttentionItem[] }) {
  const waiting = items.filter((item) => item.count > 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>Orders, stock and deliveries waiting on someone.</CardDescription>
      </CardHeader>
      {waiting.length === 0 ? (
        <CardContent className="flex flex-1">
          <EmptyState icon={CircleCheck} title="All caught up" description="Nothing is waiting on anyone right now." />
        </CardContent>
      ) : (
        <CardContent className="grid gap-1">
          {waiting.map((item) => {
            const content = (
              <>
                <div className="grid min-w-0 flex-1">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.hint}</span>
                </div>
                <Badge variant={item.urgent ? "destructive" : "secondary"} className="tabular-nums">
                  {item.count}
                </Badge>
              </>
            )
            if (item.href) {
              const RowLink = item.switchesWorkspace ? "a" : Link
              return (
                <RowLink
                  key={item.label}
                  href={item.href}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {content}
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </RowLink>
              )
            }
            return (
              <div key={item.label} className="flex items-center gap-3 py-2">
                {content}
              </div>
            )
          })}
        </CardContent>
      )}
    </Card>
  )
}
