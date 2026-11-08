"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { setBranchGroupAction } from "@/lib/actions/branch-group.actions"

const NONE = "none"
const NEW = "new"

interface BranchGroupCardProps {
  storeId: string
  current: string | null
  groups: { name: string; stores: string[] }[]
}

// Which business the store is a branch of, on Edit Store. It sits inside the store's form but saves on its own, so
// Enter in its field mustn't submit that form.
export default function BranchGroupCard({ storeId, current, groups }: BranchGroupCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [choice, setChoice] = useState(current ?? NONE)
  const [newName, setNewName] = useState("")
  const items = [{ value: NONE, label: "None: an independent store" }, ...groups.map((group) => ({ value: group.name, label: group.name })), { value: NEW, label: "A new group…" }]
  const target = choice === NONE ? null : choice === NEW ? newName.trim() : choice
  const unchanged = target === current
  const members = groups.find((group) => group.name === target)?.stores ?? []

  const save = () =>
    startTransition(async () => {
      const response = await setBranchGroupAction({ storeId, groupName: target })
      if (!response.success) {
        toast.add({ title: "Unable to save the branch group", description: response.error, type: "error" })
        return
      }
      toast.add({ title: target ? `Now a branch of ${target}` : "Now an independent store", type: "success" })
      setNewName("")
      setChoice(target ?? NONE)
      router.refresh()
    })

  return (
    <Card
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault()
      }}
    >
      <CardHeader>
        <CardTitle>Branch group</CardTitle>
        <CardDescription>Branches of one business keep the same prices.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field>
          <FieldLabel htmlFor="branch-group">Branch of</FieldLabel>
          <Select items={items} value={choice} onValueChange={(next) => next && setChoice(next)} disabled={isPending}>
            <SelectTrigger id="branch-group" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {choice === NEW && <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="BS42" maxLength={100} aria-label="New group's name" disabled={isPending} />}
        {target && members.length > 0 && <p className="text-sm text-muted-foreground">{`Its branches: ${members.join(", ")}.`}</p>}
        {target && !unchanged && <p className="text-sm text-muted-foreground">Prices already set stay as they are until a branch next changes one.</p>}
        <Button type="button" className="justify-self-end" onClick={save} disabled={isPending || unchanged || (choice === NEW && !newName.trim())}>
          {isPending && <Spinner data-icon="inline-start" />}
          Save
        </Button>
      </CardContent>
    </Card>
  )
}
