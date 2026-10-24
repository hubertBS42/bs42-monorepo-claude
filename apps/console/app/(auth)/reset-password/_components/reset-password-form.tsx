"use client"

import Link from "next/link"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldError, FieldGroup } from "@workspace/ui/components/field"
import { TextInputField } from "@workspace/forms"
import { resetPasswordSchema } from "@/lib/schemas/auth.schemas"

export function ResetPasswordForm() {
  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  const onSubmit: SubmitHandler<z.infer<typeof resetPasswordSchema>> = async (data) => {
    form.clearErrors("root")

    try {
      const result = await consoleAuthClient.requestPasswordReset({
        email: data.email,
        redirectTo: "/set-password",
      })

      if (result.error) {
        form.setError("root", {
          message: "We couldn't process your request right now. Please try again later.",
        })
        return
      }
    } catch (error) {
      console.error("Password reset request failed:", error)
      form.setError("root", {
        message: "We couldn't process your request right now. Please try again later.",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          {form.formState.isSubmitSuccessful ? "If an account exists for that email, we sent a reset link." : "Enter your email below to receive a password reset link."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {form.formState.isSubmitSuccessful ? (
          <Link href="/login" className={buttonVariants({ variant: "default" })}>
            Back to sign in
          </Link>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <TextInputField control={form.control} name="email" label="Email" type="email" autoComplete="email" placeholder="m@example.com" disabled={form.formState.isSubmitting} autoFocus />

              {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}

              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Sending..." : "Send reset link"}
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
