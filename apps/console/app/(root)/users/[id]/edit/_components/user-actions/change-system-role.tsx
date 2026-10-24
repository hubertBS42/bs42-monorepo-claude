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
import { demoteToAdminAction, promoteToSuperAdminAction } from "@/lib/actions/user.actions"
import type { User } from "@workspace/db/client"
import { ShieldMinus, ShieldPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "@workspace/ui/components/toast"

const content = {
  promote: {
    action: promoteToSuperAdminAction,
    label: "Promote to Super Admin",
    icon: ShieldPlus,
    description: (name: string) => `${name} will own every store and have full control of the platform.`,
    success: "User has been promoted to super admin.",
  },
  demote: {
    action: demoteToAdminAction,
    label: "Demote to Admin",
    icon: ShieldMinus,
    description: (name: string) => `${name} will become an admin in every store.`,
    success: "User has been demoted to admin.",
  },
}

const ChangeSystemRole = ({ user, change }: { user: User; change: "promote" | "demote" }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { action, label, icon: Icon, description, success } = content[change]

  const handleChange = () => {
    startTransition(async () => {
      const response = await action(user.id)
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
        description: success,
        type: "success",
      })
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" className="w-full" variant={"outline"}>
            <Icon className="size-4" />
            {label}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>{description(user.name ?? user.email)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleChange} disabled={isPending}>
            {isPending ? <Spinner /> : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
export default ChangeSystemRole
