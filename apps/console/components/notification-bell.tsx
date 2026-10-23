"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNowStrict } from "date-fns"
import { BadgeAlertIcon, BellIcon, CoinsIcon, FileTextIcon, type LucideIcon, PackageIcon, ShoppingBagIcon, StarIcon, Undo2Icon, BriefcaseBusinessIcon, XIcon } from "lucide-react"
import type { ActionResponse } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { toast } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"
import { clearReadNotificationsAction, dismissNotificationAction, markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notification.actions"
import type { BellNotification } from "@/lib/data/notifications.data"

// How often the bell asks for new notifications while the tab is visible
const POLL_MS = 60_000

const KIND_ICONS: Record<BellNotification["kind"], LucideIcon> = {
  ORDER: ShoppingBagIcon,
  STOCK: PackageIcon,
  REFUND: Undo2Icon,
  PAYMENT_PROBLEM: BadgeAlertIcon,
  REVIEW: StarIcon,
  TRADE_ACCOUNT: BriefcaseBusinessIcon,
  QUOTE: FileTextIcon,
  EXCHANGE_RATE: CoinsIcon,
}

type BellState = { items: BellNotification[]; unreadCount: number }

const fetchBell = (): Promise<BellState | null> => fetch("/api/notifications", { cache: "no-store" }).then((response) => (response.ok ? response.json() : null))

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<BellState | null>(null)

  const load = useCallback(() => {
    fetchBell()
      .then((data) => {
        if (data) setState(data)
      })
      .catch((error) => console.error("Could not load notifications:", error))
  }, [])

  // On load, every minute while the tab is visible, and as soon as it's shown again
  useEffect(() => {
    load()
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load])

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) load()
  }

  const markRead = (id: string) =>
    setState((current) => {
      if (!current) return current
      const wasUnread = current.items.some((item) => item.id === id && !item.read)
      return { items: current.items.map((item) => (item.id === id ? { ...item, read: true } : item)), unreadCount: current.unreadCount - (wasUnread ? 1 : 0) }
    })

  const openNotification = (notification: BellNotification) => {
    setOpen(false)
    if (!notification.read) {
      markRead(notification.id)
      void markNotificationReadAction(notification.id).catch((error) => console.error("Could not mark a notification as read:", error))
    }
    // Another workspace's page: a full load, so the sidebar and the store switcher follow the switch
    if (notification.switchesWorkspace) window.location.assign(notification.href)
    else router.push(notification.href)
  }

  // Shows the change at once and puts the list back if the action fails
  const change = async (next: (current: BellState) => BellState, action: () => Promise<ActionResponse>, failure: string, reload = false) => {
    const before = state
    setState((current) => current && next(current))
    try {
      const result = await action()
      if (result.success) {
        // Fills the list back up to its length with older ones
        if (reload) load()
        return
      }
      setState(before)
      toast.add({ title: failure, description: result.error, type: "error" })
    } catch (error) {
      console.error(`${failure}:`, error)
      setState(before)
      toast.add({ title: failure, description: "Please try again.", type: "error" })
    }
  }

  const markAllRead = () => change((current) => ({ items: current.items.map((item) => ({ ...item, read: true })), unreadCount: 0 }), markAllNotificationsReadAction, "Couldn't mark them as read")

  const dismiss = (notification: BellNotification) =>
    change(
      (current) => ({ items: current.items.filter((item) => item.id !== notification.id), unreadCount: current.unreadCount - (notification.read ? 0 : 1) }),
      () => dismissNotificationAction(notification.id),
      "Couldn't dismiss it",
      true
    )

  const clearRead = () => change((current) => ({ ...current, items: current.items.filter((item) => !item.read) }), clearReadNotificationsAction, "Couldn't clear them", true)

  const unread = state?.unreadCount ?? 0
  const anyRead = state?.items.some((item) => item.read) ?? false

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <BellIcon className="size-[1.2rem]" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-medium text-primary-foreground tabular-nums">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
            <span className="sr-only">{unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}</span>
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="font-medium">Notifications</p>
          <div className="flex items-center gap-1">
            {anyRead && (
              <Button variant="ghost" size="xs" onClick={clearRead}>
                Clear read
              </Button>
            )}
            {unread > 0 && (
              <Button variant="ghost" size="xs" onClick={markAllRead}>
                Mark all as read
              </Button>
            )}
          </div>
        </div>
        {state === null ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : state.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <BellIcon className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {state.items.map((notification) => {
              const Icon = KIND_ICONS[notification.kind]
              return (
                // The dismiss button sits beside the row's button, since buttons can't nest
                <li key={notification.id} className="group relative border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={cn(
                      "flex w-full items-start gap-3 py-3 pr-11 pl-4 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                      !notification.read && "bg-muted/50"
                    )}
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-4 text-muted-foreground" />
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className={cn("line-clamp-1 text-sm", !notification.read && "font-medium")}>{notification.title}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</span>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNowStrict(notification.createdAt, { addSuffix: true })}</span>
                    </span>
                    {!notification.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </button>
                  {/* Shown on hover or keyboard focus, and always on touch screens */}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => dismiss(notification)}
                    className="absolute top-2.5 right-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                  >
                    <XIcon />
                    <span className="sr-only">{`Dismiss "${notification.title}"`}</span>
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="border-t px-4 py-2">
          <Link href="/account/notifications" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
            Choose which notifications you get
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
