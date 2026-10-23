import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import { requireConsoleAccess } from "@/lib/auth-guard"
import { getPlatformAlertSettings, getStoreNotificationSettings } from "@/lib/data/account.data"
import PlatformAlerts from "./_components/platform-alerts"
import StoreNotifications from "./_components/store-notifications"

// Platform admins choose which of the platform's alerts reach their bell; store owners and admins choose, per store,
// the emails and bell alerts about it
export default async function NotificationsPage() {
  const { user } = await requireConsoleAccess()

  if (hasSystemRole(user.role, consoleAdminRoles)) {
    const settings = await getPlatformAlertSettings(user.id)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Which of the platform&apos;s alerts reach your bell at the top of the console. Each switch saves as you flip it. The emails to Settings → Notifications&apos; addresses have their own
            switches there.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformAlerts settings={settings} />
        </CardContent>
      </Card>
    )
  }

  const stores = await getStoreNotificationSettings(user.id, user.role)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Emails to {user.email} and the bell at the top of the console, about your stores. Each switch saves as you flip it.</CardDescription>
      </CardHeader>
      <CardContent>
        {stores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Store notifications go to each store&apos;s owners and admins. You&apos;ll be able to choose yours here once you&apos;re an owner or admin of a store.
          </p>
        ) : (
          <StoreNotifications stores={stores} />
        )}
      </CardContent>
    </Card>
  )
}
