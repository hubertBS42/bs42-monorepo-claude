"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { BadgeMinus } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { removeStoreMemberAction } from "@/lib/actions/member.actions"

export interface RemovableMember {
  id: string
  organizationId: string
  name: string
}

export default function RemoveMember({ member }: { member: RemovableMember }) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleRemove = () => {
    startTransition(async () => {
      const response = await removeStoreMemberAction({ memberId: member.id, storeId: member.organizationId })

      if (!response.success) {
        toast.add({ title: "Unable to remove the member", description: response.error, type: "error" })
        // Already gone, so there's nothing to retry: go back to the list. Otherwise the dialog stays open
        // so the user can retry or cancel on purpose.
        if (response.code === "NOT_FOUND") {
          setIsOpen(false)
          router.push("/store/members")
        }
        return
      }

      setIsOpen(false)
      toast.add({ title: "Member removed", description: `${member.name} has been removed from this store.`, type: "success" })
      router.push("/store/members")
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" className="w-full" variant="destructive">
            <BadgeMinus className="size-4" />
            Remove Member
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>{`${member.name} will be removed from this store and lose access to it.`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              event.preventDefault()
              handleRemove()
            }}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
