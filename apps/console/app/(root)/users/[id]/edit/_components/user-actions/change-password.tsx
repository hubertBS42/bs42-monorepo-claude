"use client"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { SubmitHandler, useForm } from "react-hook-form"
import { toast } from "@workspace/ui/components/toast"
import { z } from "zod"
import { KeyRound } from "lucide-react"
import { changePasswordFormSchema } from "@/lib/schemas/user.schemas"
import { consoleAuthClient } from "@workspace/auth/console-client"
import PasswordField from "@workspace/forms/components/password-field"
import { Spinner } from "@workspace/ui/components/spinner"

const ChangePassword = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<z.infer<typeof changePasswordFormSchema>>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit: SubmitHandler<z.infer<typeof changePasswordFormSchema>> = (values) => {
    startTransition(async () => {
      await consoleAuthClient.changePassword(
        {
          currentPassword: values.currentPassword,
          newPassword: values.password,
          revokeOtherSessions: true,
        },
        {
          onSuccess: () => {
            setIsOpen(false)
            form.reset()
            toast.add({
              title: "Operation successful",
              description: "Your password has been changed.",
              type: "success",
            })
          },
          onError: (ctx) => {
            if (ctx.error.code === "INVALID_PASSWORD") {
              form.setError("currentPassword", {
                type: "custom",
                message: "This password is incorrect.",
              })
            } else {
              toast.add({
                title: "Operation failed",
                description: ctx.error.message,
                type: "error",
              })
            }
          },
        }
      )
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button type="button" className="w-full" variant={"outline"}>
            <KeyRound className="size-4" />
            Change Password
          </Button>
        }
      />
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>Enter your current and new password.</DialogDescription>
        </DialogHeader>
        {/* The dialog is portaled, but React events still bubble to any form it's rendered inside */}
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            form.handleSubmit(onSubmit)(e)
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <PasswordField control={form.control} name="currentPassword" label="Current Password" disabled={isPending} />
            </div>

            <div className="col-span-2">
              <PasswordField control={form.control} name="password" label="New Password" disabled={isPending} />
            </div>
            <div className="col-span-2">
              <PasswordField control={form.control} name="confirmPassword" label="Confirm Password" disabled={isPending} />
            </div>
            <div className="col-span-2">
              <Button className="w-full" type="submit" disabled={isPending}>
                {isPending ? (
                  <Spinner />
                ) : (
                  <>
                    <KeyRound className="size-4" /> Change Password
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default ChangePassword
