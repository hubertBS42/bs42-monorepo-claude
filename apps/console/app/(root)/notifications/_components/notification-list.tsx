"use client"

import { useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BellIcon } from "lucide-react"
import type { ActionResponse } from "@workspace/contracts"
import type { NotificationKind } from "@workspace/db/enums"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import ClientOnlySelect from "@workspace/ui/components/client-only-select"
import { toast } from "@workspace/ui/components/toast"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { goToNotification, NotificationItem } from "@/components/notification-item"
import { clearReadNotificationsAction, dismissNotificationAction, markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notification.actions"
import type { BellNotification } from "@/lib/data/notifications.data"

const KIND_LABELS: Record<NotificationKind, string> = {
  ORDER: "Orders",
  STOCK: "Stock",
  REFUND: "Refunds",
  PAYMENT_PROBLEM: "Payment problems",
  REVIEW: "Reviews",
  TRADE_ACCOUNT: "Trade accounts",
  QUOTE: "Quotations",
  EXCHANGE_RATE: "Exchange rate",
}

const KIND_OPTIONS = [{ label: "All kinds", value: "all" }, ...Object.entries(KIND_LABELS).map(([value, label]) => ({ label, value }))]

interface NotificationListProps {
  data: { items: BellNotification[]; total: number; totalPages: number; unreadCount: number; readCount: number }
  filters: { page: number; unreadOnly: boolean; kind?: NotificationKind }
}

// The page's list: filters and pages in the URL, and the bell's controls. Every change refreshes the page from the server.
export default function NotificationList({ data, filters }: NotificationListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // The URL with these changes, back on the first page unless a page is given
  const hrefWith = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    if (!("page" in changes)) params.delete("page")
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  const run = (action: () => Promise<ActionResponse>, failure: string) =>
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.success) toast.add({ title: failure, description: result.error, type: "error" })
      } catch (error) {
        console.error(`${failure}:`, error)
        toast.add({ title: failure, description: "Please try again.", type: "error" })
      }
      router.refresh()
    })

  const open = (notification: BellNotification) => {
    if (!notification.read) void markNotificationReadAction(notification.id).catch((error) => console.error("Could not mark a notification as read:", error))
    goToNotification(notification, router)
  }

  const filtered = filters.unreadOnly || filters.kind

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          multiple={false}
          value={[filters.unreadOnly ? "unread" : "all"]}
          onValueChange={(value) => {
            if (value[0]) startTransition(() => router.push(hrefWith({ show: value[0] === "unread" ? "unread" : null })))
          }}
          variant="outline"
          spacing={0}
          size="sm"
          aria-label="Show"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="unread">{`Unread (${data.unreadCount})`}</ToggleGroupItem>
        </ToggleGroup>
        <ClientOnlySelect
          value={filters.kind ?? "all"}
          onValueChange={(value) => startTransition(() => router.push(hrefWith({ kind: value === "all" ? null : value })))}
          options={KIND_OPTIONS}
          size="sm"
          loadingPlaceholder="All kinds"
          className="w-44"
        />
        <div className="ml-auto flex items-center gap-1">
          {data.readCount > 0 && (
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => run(clearReadNotificationsAction, "Couldn't clear them")}>
              Clear read
            </Button>
          )}
          {data.unreadCount > 0 && (
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => run(markAllNotificationsReadAction, "Couldn't mark them as read")}>
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      <div className={cn("overflow-hidden rounded-lg border transition-opacity", isPending && "opacity-60")}>
        {data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <BellIcon className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{filtered ? "No notifications match these filters." : "No notifications yet."}</p>
          </div>
        ) : (
          <ul>
            {data.items.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                full
                onOpen={() => open(notification)}
                onDismiss={() => run(() => dismissNotificationAction(notification.id), "Couldn't dismiss it")}
              />
            ))}
          </ul>
        )}
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{`Page ${filters.page} of ${data.totalPages} · ${data.total} notifications`}</p>
          <div className="flex gap-2">
            {filters.page > 1 && (
              <Link href={hrefWith({ page: String(filters.page - 1) })} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Previous
              </Link>
            )}
            {filters.page < data.totalPages && (
              <Link href={hrefWith({ page: String(filters.page + 1) })} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
