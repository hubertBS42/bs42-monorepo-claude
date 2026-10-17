"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatDate } from "@workspace/utils/date"
import { GlobeIcon, MonitorIcon, SmartphoneIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { revokeSessionAction } from "@/lib/actions/account.actions"
import type { UserSession } from "@/lib/data/account.data"

interface SessionsListProps {
  sessions: UserSession[]
  currentSessionId: string
}

const MOBILE_PATTERN = /mobile|android|iphone|ipad/i

const DeviceIcon = ({ userAgent }: { userAgent: string | null }) => {
  if (!userAgent) return <GlobeIcon className="size-5 text-muted-foreground" />
  if (MOBILE_PATTERN.test(userAgent)) return <SmartphoneIcon className="size-5 text-muted-foreground" />
  return <MonitorIcon className="size-5 text-muted-foreground" />
}

// Order matters: Edge and Opera user agents also mention Chrome, and Chrome's mentions Safari
const getBrowser = (userAgent: string) => {
  if (/edg\//i.test(userAgent)) return "Edge"
  if (/opr\//i.test(userAgent)) return "Opera"
  if (/firefox|fxios/i.test(userAgent)) return "Firefox"
  if (/chrome|crios/i.test(userAgent)) return "Chrome"
  if (/safari/i.test(userAgent)) return "Safari"
  return null
}

// Order matters: iPhone and iPad user agents also mention Mac OS X, and Android's mentions Linux
const getOperatingSystem = (userAgent: string) => {
  if (/iphone|ipad/i.test(userAgent)) return "iOS"
  if (/android/i.test(userAgent)) return "Android"
  if (/windows/i.test(userAgent)) return "Windows"
  if (/mac os/i.test(userAgent)) return "macOS"
  if (/linux/i.test(userAgent)) return "Linux"
  return null
}

const getDeviceLabel = (userAgent: string | null) => {
  if (!userAgent) return "Unknown device"
  const browser = getBrowser(userAgent)
  const os = getOperatingSystem(userAgent)
  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? (MOBILE_PATTERN.test(userAgent) ? "Mobile device" : "Unknown device")
}

// formatDate rather than "5 minutes ago": relative times can differ between the server render and hydration
const DATE_PATTERN = "d MMM yyyy, HH:mm"

const SessionItem = ({ session, isCurrent }: { session: UserSession; isCurrent: boolean }) => {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleRevoke = () => {
    startTransition(async () => {
      const result = await revokeSessionAction(session.id)
      if (!result.success) {
        toast.add({ title: "Failed to revoke session", description: result.error, type: "error" })
        return
      }
      toast.add({ title: "Session revoked", type: "success" })
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <DeviceIcon userAgent={session.userAgent} />
        </div>
        <div className="grid min-w-0 gap-0.5">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium" title={session.userAgent ?? undefined}>
              {getDeviceLabel(session.userAgent)}
            </p>
            {isCurrent && (
              <Badge variant="outline" className="text-xs">
                This device
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {session.ipAddress || "Unknown IP"} · Signed in {formatDate(session.createdAt, DATE_PATTERN)} · Last active {formatDate(session.updatedAt, DATE_PATTERN)}
          </p>
        </div>
      </div>
      {!isCurrent && (
        <Button variant="outline" size="sm" disabled={isPending} onClick={handleRevoke}>
          {isPending ? <Spinner /> : "Revoke"}
        </Button>
      )}
    </div>
  )
}

const SessionList = ({ sessions, currentSessionId }: SessionsListProps) => {
  return (
    <div className="flex flex-col divide-y">
      {sessions.map((session) => (
        <SessionItem key={session.id} session={session} isCurrent={session.id === currentSessionId} />
      ))}
    </div>
  )
}

export default SessionList
