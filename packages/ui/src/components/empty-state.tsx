import type { LucideIcon } from "lucide-react"
import { cn } from "cn"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"

// What a list, table or card shows with nothing in it, after the storefront's
// empty account pages: an icon, a short title, a line saying what would be
// here or what to do, and any actions as children.
function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Empty data-slot="empty-state" className={cn("gap-3 p-8", className)}>
      <EmptyHeader>
        <EmptyMedia>
          <Icon className="size-8 text-muted-foreground" aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  )
}

export { EmptyState }
