import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { requireConsoleAccess } from "@/lib/auth-guard"
import { getStoreNotificationSettings } from "@/lib/data/account.data"
import StoreNotifications from "./_components/store-notifications"

export default async function NotificationsPage() {
  const { user } = await requireConsoleAccess()
  const stores = await getStoreNotificationSettings(user.id, user.role)

  const empty = hasSystemRole(user.role, consoleAdminRoles)
    ? "Store notifications go to each store's own owners and admins. Platform staff get the platform's in the bell, chosen in Settings → Notifications."
    : "Store notifications go to each store's owners and admins. You'll be able to choose yours here once you're an owner or admin of a store."

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Emails to {user.email} and the bell at the top of the console, about your stores. Each switch saves as you flip it.</CardDescription>
      </CardHeader>
      <CardContent>{stores.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <StoreNotifications stores={stores} />}</CardContent>
    </Card>
  )
}
