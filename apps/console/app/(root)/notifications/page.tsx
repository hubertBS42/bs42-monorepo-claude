import type { Metadata } from "next"
import { NOTIFICATION_LIFETIME_DAYS } from "@workspace/contracts"
import { NotificationKind } from "@workspace/db/enums"
import { getEnumParam, getPositiveIntegerParam } from "@workspace/utils/search-params"
import { requireConsoleAccess } from "@/lib/auth-guard"
import { getNotificationsPage } from "@/lib/data/notifications.data"
import NotificationList from "./_components/notification-list"

export const metadata: Metadata = { title: "Notifications" }

type NotificationsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Everything the bell has had in the last NOTIFICATION_LIFETIME_DAYS, not only its newest 20: ?show=unread, ?kind=
export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const { user, session } = await requireConsoleAccess()
  const params = await searchParams

  const filters = {
    page: getPositiveIntegerParam(params.page, 1),
    unreadOnly: getEnumParam(params.show, ["unread"]) === "unread",
    kind: getEnumParam(params.kind, Object.values(NotificationKind)),
  }
  const data = await getNotificationsPage(user.id, session.activeOrganizationId, filters)

  return (
    <main className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Notifications</h1>
        <p className="text-sm text-muted-foreground">{`Everything from the last ${NOTIFICATION_LIFETIME_DAYS} days. Choose which you get in Account → Notifications.`}</p>
      </div>
      <NotificationList data={data} filters={filters} />
    </main>
  )
}
