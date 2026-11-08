"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { useMemberRole } from "@/hooks/use-member-role"
import { setPickupSuppliersAction } from "@/lib/actions/pickup-location.actions"

interface PickupSuppliersCardProps {
  storeId: string
  groupName: string
  // The group's other branches; leadDays null when the branch doesn't supply this location
  branches: { id: string; name: string; leadDays: number | null }[]
}

// Which branches' stock can be brought here for customers to collect, and how many days it takes. On Store Details and
// Edit Store, under the pickup location; inside Edit Store's form it saves on its own, so Enter mustn't submit that.
export default function PickupSuppliersCard({ storeId, groupName, branches }: PickupSuppliersCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { role, isLoading } = useMemberRole(storeId)
  const canEdit = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { organization: ["update"] } })
  const loaded = Object.fromEntries(branches.map((branch) => [branch.id, branch.leadDays === null ? "" : String(branch.leadDays)]))
  const [days, setDays] = useState<Record<string, string>>(loaded)
  const dirty = branches.some((branch) => (days[branch.id] ?? "") !== loaded[branch.id])
  const invalid = Object.values(days).some((value) => value !== "" && !(Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 60))

  const save = () =>
    startTransition(async () => {
      const suppliers = branches.flatMap((branch) => (days[branch.id] ? [{ storeId: branch.id, leadDays: Number(days[branch.id]) }] : []))
      const response = await setPickupSuppliersAction({ storeId, suppliers })
      if (!response.success) {
        toast.add({ title: "Unable to save", description: response.error, type: "error" })
        return
      }
      toast.add({ title: "Saved", description: "Customers see the new lead times from now on.", type: "success" })
      router.refresh()
    })

  return (
    <Card
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault()
      }}
    >
      <CardHeader>
        <CardTitle>Brought from other branches</CardTitle>
        <CardDescription>{`${groupName} branches whose stock can be collected here, and the days it takes.`}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <ul className="grid gap-3">
              {branches.map((branch) => (
                <li key={branch.id} className="flex items-center justify-between gap-4">
                  <label htmlFor={`lead-${branch.id}`} className="text-sm font-medium">
                    {branch.name}
                  </label>
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      <Input
                        id={`lead-${branch.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={60}
                        value={days[branch.id] ?? ""}
                        onChange={(e) => setDays({ ...days, [branch.id]: e.target.value })}
                        placeholder="—"
                        className="w-20"
                        disabled={isPending}
                      />
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{branch.leadDays ? `${branch.leadDays} days` : "Not supplied"}</span>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">{invalid ? "Use whole days from 1 to 60." : "Leave a branch empty if it doesn't supply this location."}</p>
                <Button type="button" onClick={save} disabled={isPending || !dirty || invalid}>
                  {isPending && <Spinner data-icon="inline-start" />}
                  Save
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
