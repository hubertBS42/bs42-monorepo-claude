"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PasswordField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import { updatePasswordAction } from "@/lib/actions/account.actions"
import { updatePasswordFormSchema } from "@/lib/schemas/account.schemas"

const UpdatePasswordForm = () => {
  const form = useForm<z.infer<typeof updatePasswordFormSchema>>({
    resolver: zodResolver(updatePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const onSubmit: SubmitHandler<z.infer<typeof updatePasswordFormSchema>> = async ({ currentPassword, newPassword }) => {
    const result = await updatePasswordAction({ currentPassword, newPassword })

    if (!result.success) {
      if (result.code === "INVALID_PASSWORD") {
        form.setError("currentPassword", { type: "custom", message: "Current password is incorrect." })
      } else if (result.code === "SESSIONS_NOT_REVOKED") {
        // The password did change, so the form is done
        form.reset()
        toast.add({ title: "Password updated", description: result.error, type: "warning" })
      } else {
        toast.add({ title: "Failed to update password", description: result.error, type: "error" })
      }
      return
    }

    form.reset()
    // updatePasswordAction revokes every other session
    toast.add({ title: "Password updated", description: "You've been signed out on your other devices.", type: "success" })
  }

  const isPending = form.formState.isSubmitting

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-6">
        <FieldGroup>
          <PasswordField control={form.control} name="currentPassword" label="Current password" autoComplete="current-password" disabled={isPending} />
          <PasswordField control={form.control} name="newPassword" label="New password" description="At least 8 characters." autoComplete="new-password" disabled={isPending} />
          <PasswordField control={form.control} name="confirmPassword" label="Confirm new password" autoComplete="new-password" disabled={isPending} />
        </FieldGroup>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending || !form.formState.isDirty}>
            {isPending ? <Spinner /> : "Update password"}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default UpdatePasswordForm
