"use client"

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
import { unbanUserAction } from "@/lib/actions/user.actions"
import type { User } from "@workspace/db/client"
import { ShieldCheck } from "lucide-react"
import { Spinner } from "@workspace/ui/components/spinner"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "@workspace/ui/components/toast"

const UnbanUser = ({ user }: { user: User }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleUnban = () => {
    startTransition(async () => {
      const response = await unbanUserAction(user.id)
      if (!response.success) {
        toast.add({
          title: "Operation failed",
          description: response.error,
          type: "error",
        })
        return
      }

      setIsOpen(false)
      router.refresh()
      toast.add({
        title: "Operation successful",
        description: "The user has been successfully unbanned.",
        type: "success",
      })
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" className="w-full text-red-500 hover:bg-red-50 hover:text-red-700" variant={"outline"}>
            <ShieldCheck className="size-5" /> Unban User
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>{`${user.name ?? user.email} will be able to sign in again.`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleUnban} disabled={isPending}>
            {isPending ? <Spinner /> : "Proceed"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
export default UnbanUser
