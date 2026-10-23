"use client"

import { useState, useTransition } from "react"
import { PLATFORM_ALERTS, type PlatformAlertKey } from "@workspace/contracts"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@workspace/ui/components/field"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import { setPlatformAlertAction } from "@/lib/actions/account.actions"

// A platform admin's own bell for each of the platform's alerts. Each switch saves on its own as it's flipped, and goes
// back if saving fails. Settings' switches decide only the emails.
export default function PlatformAlerts({ settings }: { settings: { alert: PlatformAlertKey; bell: boolean }[] }) {
  const [values, setValues] = useState(() => Object.fromEntries(settings.map((item) => [item.alert, item.bell])) as Record<PlatformAlertKey, boolean>)
  const [saving, setSaving] = useState<PlatformAlertKey | null>(null)
  const [, startTransition] = useTransition()

  const change = (alert: PlatformAlertKey, bell: boolean) => {
    setValues((current) => ({ ...current, [alert]: bell }))
    setSaving(alert)
    startTransition(async () => {
      try {
        const result = await setPlatformAlertAction({ alert, bell })
        if (result.success) return
        setValues((current) => ({ ...current, [alert]: !bell }))
        toast.add({ title: "Couldn't save your preference", description: result.error, type: "error" })
      } catch (error) {
        console.error("Saving a platform alert preference failed:", error)
        setValues((current) => ({ ...current, [alert]: !bell }))
        toast.add({ title: "Couldn't save your preference", description: "Please try again.", type: "error" })
      } finally {
        setSaving(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {PLATFORM_ALERTS.map(({ alert, label, description }) => {
        const id = `platform-alert-${alert}`
        return (
          <Field key={alert} orientation="horizontal" className="rounded-lg border p-3" data-disabled={saving === alert}>
            <FieldContent className="gap-y-1">
              <FieldLabel htmlFor={id}>{label}</FieldLabel>
              <FieldDescription>{description}</FieldDescription>
            </FieldContent>
            <Switch id={id} checked={values[alert]} disabled={saving === alert} onCheckedChange={(checked) => change(alert, checked)} />
          </Field>
        )
      })}
      <p className="text-xs text-muted-foreground">Payment problems always reach your bell: someone has to give the money back.</p>
    </div>
  )
}
