"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { PhoneField, TextareaField, TextInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatPhoneNumber } from "@workspace/utils/phone"
import { useMemberRole } from "@/hooks/use-member-role"
import { removePickupLocationAction, savePickupLocationAction } from "@/lib/actions/pickup-location.actions"
import { pickupLocationFormSchema } from "@/lib/schemas/pickup-location.schemas"

type Values = z.input<typeof pickupLocationFormSchema>

interface PickupLocationCardProps {
  storeId: string
  location: { name: string; address: string; hours: string | null; phone: string | null; mapUrl: string | null; updatedAt: Date } | null
}

// Where customers collect this store's pickup orders. Without one, pickups from the store aren't offered to customers.
// On Store Details and the platform's Edit Store page, where it sits inside the store's form: it saves on its own, so
// Enter in its fields mustn't submit that form.
export default function PickupLocationCard({ storeId, location }: PickupLocationCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { role, isLoading } = useMemberRole(storeId)
  const canEdit = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { organization: ["update"] } })
  const form = useForm<Values>({
    resolver: zodResolver(pickupLocationFormSchema),
    defaultValues: { name: location?.name ?? "", address: location?.address ?? "", hours: location?.hours ?? "", phone: location?.phone ?? "", mapUrl: location?.mapUrl ?? "" },
  })

  const after = (response: { success: boolean; error?: string; code?: string }, title: string) => {
    if (!response.success) {
      toast.add({ title: "Unable to save the pickup location", description: response.error, type: "error" })
      if (response.code === "CONFLICT") router.refresh()
      return
    }
    toast.add({ title, type: "success" })
    form.reset(form.getValues())
    router.refresh()
  }

  const save = form.handleSubmit((values) =>
    startTransition(async () => after(await savePickupLocationAction({ ...values, storeId, updatedAt: location?.updatedAt.toISOString() ?? null }), "Pickup location saved"))
  )
  const remove = () => startTransition(async () => after(await removePickupLocationAction({ storeId }), "Pickup location removed"))

  return (
    <Card
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault()
      }}
    >
      <CardHeader>
        <CardTitle>Pickup location</CardTitle>
        <CardDescription>{location ? "Where customers collect this store's pickup orders." : "Customers can't collect from this store until it has one."}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !canEdit ? (
          location ? (
            <div className="grid gap-1 text-sm">
              <p className="font-medium">{location.name}</p>
              <p className="whitespace-pre-line text-muted-foreground">{location.address}</p>
              {location.hours && <p className="text-muted-foreground">{location.hours}</p>}
              {location.phone && <p className="text-muted-foreground">{formatPhoneNumber(location.phone)}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">None set. The store&apos;s owners and admins can add one.</p>
          )
        ) : (
          // A div, not a form: the page has no form of its own, but Enter in a field shouldn't save half-typed details
          <div className="grid gap-4">
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInputField control={form.control} label="Name customers see" name="name" placeholder="BS42 Accra" maxLength={100} disabled={isPending} />
                <PhoneField control={form.control} label="Phone (optional)" name="phone" defaultCountry="GH" disabled={isPending} />
              </div>
              <TextareaField control={form.control} label="Address" name="address" rows={2} maxLength={300} disabled={isPending} />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInputField control={form.control} label="Opening hours (optional)" name="hours" placeholder="Mon–Fri 9am–5pm, Sat 10am–2pm" maxLength={200} disabled={isPending} />
                <TextInputField control={form.control} label="Map link (optional)" name="mapUrl" placeholder="https://maps.app.goo.gl/…" disabled={isPending} />
              </div>
            </FieldGroup>
            <div className="flex flex-wrap justify-end gap-2">
              {location && (
                <Button type="button" variant="ghost" onClick={remove} disabled={isPending}>
                  Remove
                </Button>
              )}
              <Button type="button" onClick={() => void save()} disabled={isPending || (!!location && !form.formState.isDirty)}>
                {isPending && <Spinner data-icon="inline-start" />}
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
