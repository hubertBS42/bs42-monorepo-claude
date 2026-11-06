"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import PasswordField from "@workspace/forms/components/password-field"
import PhoneField from "@workspace/forms/components/phone-field"
import TextInputField from "@workspace/forms/components/text-input-field"
import { useRevalidateOnChange } from "@workspace/forms/use-revalidate-on-change"
import { Button } from "@workspace/ui/components/button"
import { FieldError } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { changePasswordAction, updateProfileAction } from "@/lib/actions/account.actions"
import { changePasswordSchema, profileSchema, type ChangePasswordValues, type ProfileValues } from "@/lib/schemas/account.schemas"

// The account's name and phone. The email is shown on the page, not here: it can't change.
export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const router = useRouter()
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: initial })
  useRevalidateOnChange(form)
  const { isSubmitting, isDirty } = form.formState

  async function onSubmit(values: ProfileValues) {
    form.clearErrors("root")
    try {
      const result = await updateProfileAction(values)
      if (!result.success) {
        form.setError("root", { message: result.error })
        if (result.code === "UNAUTHORIZED") router.refresh()
        return
      }
      toast.add({ title: "Details saved", type: "success" })
      form.reset(values)
      // The header shows the name
      router.refresh()
    } catch (error) {
      console.error("Saving account details failed:", error)
      form.setError("root", { message: "We couldn't save that just now. Please try again." })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <TextInputField control={form.control} name="name" label="Full name" autoComplete="name" maxLength={200} disabled={isSubmitting} />
      <PhoneField control={form.control} name="phone" label="Phone (optional)" defaultCountry="GH" disabled={isSubmitting} />
      {form.formState.errors.root && (
        <div className="sm:col-span-2">
          <FieldError errors={[form.formState.errors.root]} />
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Save details
        </Button>
      </div>
    </form>
  )
}

// A new password, given the current one; other devices are signed out once it's changed
export function ChangePasswordForm() {
  const router = useRouter()
  const empty = { currentPassword: "", password: "", confirmPassword: "" }
  const form = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: empty })
  useRevalidateOnChange(form)
  const { isSubmitting } = form.formState

  async function onSubmit(values: ChangePasswordValues) {
    form.clearErrors("root")
    try {
      const result = await changePasswordAction(values)
      if (!result.success) {
        if (result.code === "INVALID_PASSWORD") form.setError("currentPassword", { message: result.error })
        else form.setError("root", { message: result.error })
        if (result.code === "UNAUTHORIZED") router.refresh()
        return
      }
      toast.add({ title: "Password changed", description: "Your other devices have been signed out.", type: "success" })
      form.reset(empty)
    } catch (error) {
      console.error("Changing the password failed:", error)
      form.setError("root", { message: "We couldn't change your password just now. Please try again." })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
        <PasswordField control={form.control} name="currentPassword" label="Current password" autoComplete="current-password" disabled={isSubmitting} />
      </div>
      <PasswordField control={form.control} name="password" label="New password" autoComplete="new-password" disabled={isSubmitting} />
      <PasswordField control={form.control} name="confirmPassword" label="Confirm new password" autoComplete="new-password" disabled={isSubmitting} />
      {form.formState.errors.root && (
        <div className="sm:col-span-2">
          <FieldError errors={[form.formState.errors.root]} />
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Change password
        </Button>
      </div>
    </form>
  )
}
