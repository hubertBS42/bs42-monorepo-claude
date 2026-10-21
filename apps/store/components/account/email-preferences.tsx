"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"

import { setEmailPreferenceAction } from "@/lib/actions/account.actions"

type Preference = "getOrderEmails" | "getMarketingEmails"

const PREFERENCES: { key: Preference; label: string; description: string }[] = [
  {
    key: "getOrderEmails",
    label: "Order updates",
    description: "Confirmation, delivery, refund and return emails for orders placed signed in to this account. Account emails, such as password resets, always come.",
  },
  { key: "getMarketingEmails", label: "News and offers", description: "New products and offers, now and then." },
]

// Each switch saves on its own as it's flipped, and goes back if saving fails
export function EmailPreferences({ initial }: { initial: Record<Preference, boolean> }) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState<Preference | null>(null)
  const [, startTransition] = useTransition()

  const change = (preference: Preference, enabled: boolean) => {
    setValues((current) => ({ ...current, [preference]: enabled }))
    setSaving(preference)
    startTransition(async () => {
      try {
        const result = await setEmailPreferenceAction({ preference, enabled })
        if (result.success) return
        setValues((current) => ({ ...current, [preference]: !enabled }))
        toast.add({ title: "Couldn't save your preference", description: result.error, type: "error" })
        if (result.code === "UNAUTHORIZED") router.refresh()
      } catch (error) {
        console.error("Saving an email preference failed:", error)
        setValues((current) => ({ ...current, [preference]: !enabled }))
        toast.add({ title: "Couldn't save your preference", description: "Please try again.", type: "error" })
      } finally {
        setSaving(null)
      }
    })
  }

  return (
    <FieldGroup>
      {PREFERENCES.map(({ key, label, description }) => (
        <Field key={key} orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={key}>{label}</FieldLabel>
            <FieldDescription>{description}</FieldDescription>
          </FieldContent>
          <Switch id={key} checked={values[key]} disabled={saving !== null} onCheckedChange={(checked) => change(key, checked)} />
        </Field>
      ))}
    </FieldGroup>
  )
}
