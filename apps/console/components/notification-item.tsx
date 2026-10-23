"use client"

import type { useRouter } from "next/navigation"
import { formatDistanceToNowStrict } from "date-fns"
import { BadgeAlertIcon, BriefcaseBusinessIcon, CoinsIcon, FileTextIcon, type LucideIcon, PackageIcon, PackagePlusIcon, ShoppingBagIcon, StarIcon, Undo2Icon, XIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { BellNotification } from "@/lib/data/notifications.data"

// One notification, as the header's bell and the notifications page list it

export const KIND_ICONS: Record<BellNotification["kind"], LucideIcon> = {
  ORDER: ShoppingBagIcon,
  STOCK: PackageIcon,
  REFUND: Undo2Icon,
  PAYMENT_PROBLEM: BadgeAlertIcon,
  REVIEW: StarIcon,
  TRADE_ACCOUNT: BriefcaseBusinessIcon,
  QUOTE: FileTextIcon,
  EXCHANGE_RATE: CoinsIcon,
  PRODUCT_REQUEST: PackagePlusIcon,
}

// Another workspace's page is a full load, so the sidebar and the store switcher follow the switch
export function goToNotification(notification: BellNotification, router: ReturnType<typeof useRouter>) {
  if (notification.switchesWorkspace) window.location.assign(notification.href)
  else router.push(notification.href)
}

export function NotificationItem({ notification, onOpen, onDismiss, full }: { notification: BellNotification; onOpen: () => void; onDismiss: () => void; full?: boolean }) {
  const Icon = KIND_ICONS[notification.kind]
  return (
    // The dismiss button sits beside the row's button, since buttons can't nest
    <li className="group relative border-b last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-start gap-3 py-3 pr-11 pl-4 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
          !notification.read && "bg-muted/50"
        )}
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          {/* The page has room for the whole text; the bell clamps it */}
          <span className={cn("text-sm", !full && "line-clamp-1", !notification.read && "font-medium")}>{notification.title}</span>
          <span className={cn("text-xs text-muted-foreground", !full && "line-clamp-2")}>{notification.body}</span>
          <span className="text-xs text-muted-foreground">{formatDistanceToNowStrict(notification.createdAt, { addSuffix: true })}</span>
        </span>
        {!notification.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
      </button>
      {/* Shown on hover or keyboard focus, and always on touch screens */}
      <Button variant="ghost" size="icon-xs" onClick={onDismiss} className="absolute top-2.5 right-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
        <XIcon />
        <span className="sr-only">{`Dismiss "${notification.title}"`}</span>
      </Button>
    </li>
  )
}
