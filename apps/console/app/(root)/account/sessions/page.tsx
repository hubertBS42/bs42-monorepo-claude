import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { requireConsoleAccess } from "@/lib/auth-guard"
import { getUserSessions } from "@/lib/data/account.data"
import RevokeOtherSessions from "./_components/revoke-other-sessions"
import SessionList from "./_components/session-list"

export default async function SessionsPage() {
  const { user, session } = await requireConsoleAccess()
  const sessions = await getUserSessions(user.id)

  // This device first, then the rest by when they were last active
  const sorted = [...sessions].sort((a, b) => Number(b.id === session.id) - Number(a.id === session.id))
  const hasOtherSessions = sorted.some((s) => s.id !== session.id)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle>Sessions</CardTitle>
            <CardDescription>Devices signed in to your account. Revoke any you don&apos;t recognise.</CardDescription>
          </div>
          {hasOtherSessions && <RevokeOtherSessions />}
        </div>
      </CardHeader>
      <CardContent>
        <SessionList sessions={sorted} currentSessionId={session.id} />
      </CardContent>
    </Card>
  )
}
