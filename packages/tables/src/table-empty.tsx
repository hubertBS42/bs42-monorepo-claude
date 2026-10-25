"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Inbox, SearchX, type LucideIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { EmptyState } from "@workspace/ui/components/empty-state"
import { TableCell, TableRow } from "@workspace/ui/components/table"
import type { FilterConfig } from "./data-table"

// What a table shows with no rows: its own empty state ("No orders yet"), or, when filters hid every row, that
// nothing matches with a link that clears them
export interface TableEmptyConfig {
  icon?: LucideIcon
  title: string
  description?: string
}

// The URL parameters each filter type writes (filters-toolbar.tsx)
const filterParams = (filter: FilterConfig) =>
  filter.type === "dateRange" ? [`${filter.key}Start`, `${filter.key}End`] : filter.type === "numberRange" ? [`${filter.key}Min`, `${filter.key}Max`] : [filter.key]

export function TableEmpty({ colSpan, filters, empty }: { colSpan: number; filters: FilterConfig[]; empty?: TableEmptyConfig }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const keys = filters.flatMap(filterParams)
  const filtered = keys.some((key) => searchParams.get(key))

  let content
  if (filtered) {
    // The filters go, and the page with them; anything else in the URL stays
    const params = new URLSearchParams(searchParams.toString())
    for (const key of [...keys, "page"]) params.delete(key)
    const query = params.toString()
    content = (
      <EmptyState icon={SearchX} title="No results" description="Nothing matches these filters.">
        <Button variant="outline" size="sm" render={<Link href={query ? `${pathname}?${query}` : pathname} scroll={false} />}>
          Clear filters
        </Button>
      </EmptyState>
    )
  } else {
    content = <EmptyState icon={empty?.icon ?? Inbox} title={empty?.title ?? "Nothing here yet"} description={empty?.description} />
  }

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="whitespace-normal">
        {content}
      </TableCell>
    </TableRow>
  )
}
