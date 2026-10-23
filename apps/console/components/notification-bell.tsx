"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BellIcon } from "lucide-react"
import type { ActionResponse } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { toast } from "@workspace/ui/components/toast"
import { clearReadNotificationsAction, dismissNotificationAction, markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notification.actions"
import type { BellNotification } from "@/lib/data/notifications.data"
import { goToNotification, NotificationItem } from "./notification-item"

// How often the bell asks for new notifications while the tab is visible: a small query, close enough to live
const POLL_MS = 15_000

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

  // On load, every POLL_MS while the tab is visible, and as soon as it's shown again
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
    goToNotification(notification, router)
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
            {state.items.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onOpen={() => openNotification(notification)} onDismiss={() => dismiss(notification)} />
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2">
          <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs font-medium hover:underline">
            View all
          </Link>
          <Link href="/account/notifications" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
            Choose which you get
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
