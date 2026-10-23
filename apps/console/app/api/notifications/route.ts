import { consoleAuth } from "@workspace/auth/console"
import { hasConsoleAccess } from "@/lib/auth-guard"
import { getBellNotifications } from "@/lib/data/notifications.data"

// The header's bell (components/notification-bell.tsx), polled while the console is open. /api skips proxy.ts, so this
// checks for a console user itself, as the storage routes do.
export async function GET(request: Request) {
  const session = await consoleAuth.api.getSession({ headers: request.headers })
  if (!session) return Response.json({ error: "You must be signed in." }, { status: 401 })
  if (!(await hasConsoleAccess(session.user))) return Response.json({ error: "You don't have access to the console." }, { status: 403 })

  const notifications = await getBellNotifications(session.user.id, session.session.activeOrganizationId)
  return Response.json(notifications, { headers: { "Cache-Control": "private, no-store" } })
}
