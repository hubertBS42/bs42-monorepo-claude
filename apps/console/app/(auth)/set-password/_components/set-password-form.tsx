"use client"

import { setPasswordSchema } from "@/lib/schemas/auth.schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { PasswordField } from "@workspace/forms"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldError, FieldGroup } from "@workspace/ui/components/field"
import Link from "next/link"
import { useState } from "react"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"

export function SetPasswordForm({ token, invalidToken = false }: { token?: string; invalidToken?: boolean }) {
  const [isUpdated, setIsUpdated] = useState(false)
  const form = useForm<z.infer<typeof setPasswordSchema>>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit: SubmitHandler<z.infer<typeof setPasswordSchema>> = async (data) => {
    form.clearErrors("root")

    if (!token || invalidToken) {
      form.setError("root", {
        message: "This password reset link is invalid or has expired. Request a new link and try again.",
      })
      return
    }

    try {
      const result = await consoleAuthClient.resetPassword({
        newPassword: data.password,
        token,
      })

      if (result.error) {
        form.setError("root", {
          message: "This password reset link is invalid or has expired. Request a new link and try again.",
        })
        return
      }
      setIsUpdated(true)
    } catch (error) {
      console.error("Password update failed:", error)
      form.setError("root", {
        message: "We couldn't update your password right now. Request a new link and try again.",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>
          {isUpdated ? "Your password has been updated successfully." : "Enter your new password below to set a new password."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isUpdated ? (
          <Link href="/login" className={buttonVariants({ variant: "default" })}>
            Continue to sign in
          </Link>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              {!token || invalidToken ? (
                <div className="space-y-4">
                  <p role="alert" className="text-sm text-destructive">
                    This password reset link is invalid or has expired.
                  </p>
                  <Link href="/reset-password" className={buttonVariants({ variant: "default" })}>
                    Request a new reset link
                  </Link>
                </div>
              ) : (
                <>
                  <PasswordField
                    control={form.control}
                    name="password"
                    label="Password"
                    placeholder="Enter your password"
                    autoComplete="new-password"
                    autoFocus
                    description="Use at least 8 characters."
                    disabled={form.formState.isSubmitting}
                  />

                  <PasswordField
                    control={form.control}
                    name="confirmPassword"
                    label="Confirm password"
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    disabled={form.formState.isSubmitting}
                  />

                  {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}

                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Updating..." : "Update password"}
                  </Button>
                </>
              )}
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
