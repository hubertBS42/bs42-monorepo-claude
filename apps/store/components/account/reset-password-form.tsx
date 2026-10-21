"use client"

import { useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { storeAuthClient } from "@workspace/auth/store-client"
import PasswordField from "@workspace/forms/components/password-field"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldError, FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"

import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/schemas/account.schemas"

// The reset email's link lands here with its token, or with ?error=INVALID_TOKEN once it has expired or been used
export function ResetPasswordForm({ token }: { token: string | null }) {
  const [done, setDone] = useState(false)
  const [invalid, setInvalid] = useState(!token)
  const form = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } })

  async function onSubmit(values: ResetPasswordValues) {
    if (!token) return
    form.clearErrors("root")
    try {
      const result = await storeAuthClient.resetPassword({ newPassword: values.password, token })
      if (result.error) {
        if (result.error.code === "INVALID_TOKEN") setInvalid(true)
        else form.setError("root", { message: result.error.message ?? "We couldn't change your password. Please try again." })
        return
      }
      setDone(true)
    } catch (error) {
      console.error("Password reset failed:", error)
      form.setError("root", { message: "We couldn't change your password right now. Please try again." })
    }
  }

  if (invalid || done) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{done ? "Password changed" : "This link has expired"}</CardTitle>
          <CardDescription>
            {done ? "Sign in with your new password. You've been signed out everywhere else." : "Reset links last 30 minutes and work once. Ask for a new one and try again."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={done ? "/sign-in" : "/forgot-password"} className={buttonVariants({ className: "w-full" })}>
            {done ? "Sign in" : "Send a new link"}
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>Use at least 8 characters</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <PasswordField control={form.control} name="password" label="New password" autoComplete="new-password" autoFocus />
            <PasswordField control={form.control} name="confirmPassword" label="Confirm password" autoComplete="new-password" />
            {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}
            <Field>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner />}
                Change password
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
