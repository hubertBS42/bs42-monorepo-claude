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
import { Spinner } from "@workspace/ui/components/spinner"
import { deleteUserAction } from "@/lib/actions/user.actions"
import type { User } from "@workspace/db/client"
import { Trash2 } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "@workspace/ui/components/toast"
import { useRouter } from "next/navigation"

const DeleteUser = ({ user }: { user: User }) => {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleDelete = () => {
    startTransition(async () => {
      const response = await deleteUserAction(user.id)

      if (!response.success) {
        setIsOpen(false)
        toast.add({
          title: "Operation failed",
          description: response.error,
          type: "error",
        })
        return
      }

      toast.add({
        title: "Operation successful",
        description: "User account is deleted.",
        type: "success",
      })
      router.push("/users")
    })
  }
  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" className="w-full" variant={"destructive"}>
            <Trash2 className="size-4" />
            Delete User
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>{`This can't be undone. ${user.name ?? user.email}'s account will be permanently deleted.`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending ? <Spinner /> : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
export default DeleteUser
