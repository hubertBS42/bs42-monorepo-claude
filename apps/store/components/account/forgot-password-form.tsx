"use client"

import { useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { storeAuthClient } from "@workspace/auth/store-client"
import TextInputField from "@workspace/forms/components/text-input-field"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldDescription, FieldError, FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"

import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/schemas/account.schemas"

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } })

  async function onSubmit(values: ForgotPasswordValues) {
    form.clearErrors("root")
    try {
      // The email's link opens /reset-password with its token
      const result = await storeAuthClient.requestPasswordReset({ email: values.email.trim(), redirectTo: "/reset-password" })
      if (!result.error) {
        setSent(true)
        return
      }
      console.error("Password reset request failed:", result.error)
    } catch (error) {
      console.error("Password reset request failed:", error)
    }
    form.setError("root", { message: "We couldn't send a reset link right now. Please try again in a minute." })
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          {sent ? "If there's an account with that email, we've sent it a link to choose a new password." : "Enter your email and we'll send you a link to choose a new password"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <Link href="/sign-in" className={buttonVariants({ variant: "outline", className: "w-full" })}>
            Back to sign in
          </Link>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <TextInputField control={form.control} name="email" label="Email" type="email" placeholder="m@example.com" autoComplete="email" autoFocus />
              {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}
              <Field>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Spinner />}
                  Send reset link
                </Button>
                <FieldDescription className="text-center">
                  Remembered it? <Link href="/sign-in">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
