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
import { sendPasswordResetEmailAction } from "@/lib/actions/user.actions"
import type { User } from "@workspace/db/client"
import { RotateCcw } from "lucide-react"
import { Spinner } from "@workspace/ui/components/spinner"
import { useState, useTransition } from "react"
import { toast } from "@workspace/ui/components/toast"

const ResetPassword = ({ user }: { user: User }) => {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)

  const handleReset = () => {
    startTransition(async () => {
      const response = await sendPasswordResetEmailAction(user.id)

      if (!response.success) {
        toast.add({
          title: "Operation failed",
          description: response.error,
          type: "error",
        })
        return
      }

      setIsOpen(false)
      toast.add({
        title: "Operation successful",
        description: "Reset email has been sent.",
        type: "success",
      })
    })
  }
  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" className="w-full" variant={"outline"}>
            <RotateCcw />
            Reset Password
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>{`An email with a password reset link is about to be sent to ${user.name ?? user.email}, do you wish to continue?`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset} disabled={isPending}>
            {isPending ? <Spinner /> : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
export default ResetPassword
