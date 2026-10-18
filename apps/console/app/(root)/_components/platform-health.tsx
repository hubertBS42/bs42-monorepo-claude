import Link from "next/link"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { formatDate } from "@workspace/utils/date"
import type { ExchangeRateInfo } from "@/lib/data/exchange-rates.data"

interface Check {
  label: string
  detail: string
  state: "ok" | "warning" | "off"
}

const STATE_BADGES = {
  ok: { variant: "success", label: "OK" },
  warning: { variant: "destructive", label: "Action needed" },
  off: { variant: "outline", label: "Off" },
} as const

interface PlatformHealthProps {
  rate: ExchangeRateInfo | null
  taxEnabled: boolean
  mailerConfigured: boolean
  notificationRecipients: number
  // Only superAdmins can open Settings
  canOpenSettings: boolean
}

export default function PlatformHealth({ rate, taxEnabled, mailerConfigured, notificationRecipients, canOpenSettings }: PlatformHealthProps) {
  const checks: Check[] = [
    !rate
      ? { label: "Exchange rate", detail: "No USD to GHS rate yet, so no order can be created.", state: "warning" }
      : rate.isStale
        ? { label: "Exchange rate", detail: `The latest rate is from ${formatDate(`${rate.date}T00:00:00Z`, "LLL dd")}, too old for orders to use.`, state: "warning" }
        : {
            label: "Exchange rate",
            detail: `GH₵${Number(rate.rate)} per $1 for ${formatDate(`${rate.date}T00:00:00Z`, "LLL dd")}, ${rate.source === "MANUAL" ? "set by hand" : "fetched"}.`,
            state: "ok",
          },
    { label: "Tax", detail: taxEnabled ? "Charged on new orders." : "Not charged on orders.", state: taxEnabled ? "ok" : "off" },
    mailerConfigured
      ? { label: "Email", detail: "Customer and staff emails can be sent.", state: "ok" }
      : { label: "Email", detail: "SITE_MAILER_* isn't set, so no email is sent.", state: "warning" },
    {
      label: "Staff notifications",
      detail: notificationRecipients ? `Sent to ${notificationRecipients} address${notificationRecipients === 1 ? "" : "es"}.` : "No recipients, so nobody hears about new orders or low stock.",
      state: notificationRecipients ? "ok" : "warning",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform checks</CardTitle>
        <CardDescription>
          {canOpenSettings ? (
            <>
              Change these in{" "}
              <Link href="/settings" className="underline underline-offset-4">
                Settings
              </Link>
              .
            </>
          ) : (
            "A superAdmin can change these in Settings."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {checks.map((check) => (
          <div key={check.label} className="grid content-start gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{check.label}</span>
              <Badge variant={STATE_BADGES[check.state].variant}>{STATE_BADGES[check.state].label}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">{check.detail}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
