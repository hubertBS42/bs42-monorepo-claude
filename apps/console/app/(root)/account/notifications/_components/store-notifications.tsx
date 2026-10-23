"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@workspace/ui/components/field"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "@workspace/ui/components/toast"
import { setStoreNotificationAction } from "@/lib/actions/account.actions"
import type { StoreNotificationSettings } from "@/lib/data/account.data"
import type { STORE_NOTIFICATION_PREFERENCES } from "@/lib/schemas/account.schemas"

type Preference = (typeof STORE_NOTIFICATION_PREFERENCES)[number]

const SWITCHES: { key: Preference; label: string; description: string }[] = [
  { key: "notifyOrders", label: "New orders", description: "When a customer's order with the store's items is paid, or someone else creates one in the store" },
  { key: "notifyStock", label: "Low and out of stock", description: "When a sale takes one of the store's items down to its low-stock threshold, or to 0" },
  { key: "notifyRefunds", label: "Refunds", description: "When someone else gives money back on one of the store's own orders, on its own or with a return" },
]

// Each switch saves on its own as it's flipped, and goes back if saving fails
export default function StoreNotifications({ stores }: { stores: StoreNotificationSettings[] }) {
  const router = useRouter()
  const [values, setValues] = useState(() => Object.fromEntries(stores.map((store) => [store.storeId, store.preferences])))
  const [saving, setSaving] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const set = (storeId: string, preference: Preference, enabled: boolean) => setValues((current) => ({ ...current, [storeId]: { ...current[storeId]!, [preference]: enabled } }))

  const change = (storeId: string, preference: Preference, enabled: boolean) => {
    set(storeId, preference, enabled)
    setSaving(storeId)
    startTransition(async () => {
      try {
        const result = await setStoreNotificationAction({ storeId, preference, enabled })
        if (result.success) return
        set(storeId, preference, !enabled)
        toast.add({ title: "Couldn't save your preference", description: result.error, type: "error" })
        if (result.code === "NOT_MEMBER") router.refresh()
      } catch (error) {
        console.error("Saving a store notification preference failed:", error)
        set(storeId, preference, !enabled)
        toast.add({ title: "Couldn't save your preference", description: "Please try again.", type: "error" })
      } finally {
        setSaving(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {stores.map((store) => (
        <section key={store.storeId} className="flex flex-col gap-3">
          {stores.length > 1 && <h3 className="text-sm font-medium">{store.storeName}</h3>}
          {SWITCHES.map(({ key, label, description }) => {
            const id = `${store.storeId}-${key}`
            return (
              <Field key={key} orientation="horizontal" className="rounded-lg border p-3" data-disabled={saving === store.storeId}>
                <FieldContent className="gap-y-1">
                  <FieldLabel htmlFor={id}>{label}</FieldLabel>
                  <FieldDescription>{description}</FieldDescription>
                </FieldContent>
                <Switch id={id} checked={values[store.storeId]![key]} disabled={saving === store.storeId} onCheckedChange={(checked) => change(store.storeId, key, checked)} />
              </Field>
            )
          })}
        </section>
      ))}
    </div>
  )
}
