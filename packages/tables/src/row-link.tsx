import type { RowData } from "@tanstack/react-table"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    // The cell renders its own RowLink instead of being wrapped in one, so it can hold a second link (a link
    // can't contain another). Clicks on any link inside a row keep their own target; the rest open the row.
    rendersRowLink?: boolean
  }
}

// The link a row's main cell gets from getRowHref, for cells that render it themselves
export function RowLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cn("font-medium underline-offset-4 hover:underline", className)}>
      {children}
    </Link>
  )
}
