"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { SubmitHandler, useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@workspace/ui/components/button"
import { CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { PasswordField, TextInputField } from "@workspace/forms"
import { createInitialAdmin } from "@/lib/actions/bootstrap.actions"
import { setupFormSchema } from "@/lib/schemas/bootstrap.schemas"

export function SetupForm() {
  const router = useRouter()

  const form = useForm<z.infer<typeof setupFormSchema>>({
    resolver: zodResolver(setupFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit: SubmitHandler<z.infer<typeof setupFormSchema>> = async (data) => {
    form.clearErrors("root")

    const result = await createInitialAdmin(data)
    if (result.status === "created") {
      router.replace("/login?setupComplete=1")
      return
    }

    form.setError("root", {
      message:
        result.status === "already-initialized"
          ? "Initial setup has already been completed. Sign in instead."
          : result.status === "in-progress"
            ? "Setup is already in progress. Please wait and try again."
            : result.status === "invalid"
              ? "Please check your details and try again."
              : "Unable to complete setup. Please try again or contact your database administrator.",
    })
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <CardHeader className="px-0">
        <CardTitle className="text-2xl">Create your administrator account</CardTitle>
        <CardDescription>Enter your details below to get started.</CardDescription>
      </CardHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8">
        <FieldGroup>
          <TextInputField
            control={form.control}
            name="fullName"
            label="Full name"
            placeholder="Alex Morgan"
            autoComplete="name"
            disabled={form.formState.isSubmitting}
          />

          <TextInputField
            control={form.control}
            name="email"
            label="Email"
            type="email"
            placeholder="alex@example.com"
            autoComplete="email"
            disabled={form.formState.isSubmitting}
          />

          <PasswordField
            control={form.control}
            name="password"
            label="Password"
            placeholder="Enter your password"
            autoComplete="new-password"
            description="Use at least 8 characters and keep it secure."
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

          {form.formState.errors.root && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Setting up account..." : "Continue"}
            {!form.formState.isSubmitting && <ArrowRight className="size-4" />}
          </Button>
        </FieldGroup>
      </form>

      <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
        By continuing, you confirm the information is correct and keep your account secure.
      </p>
    </div>
  )
}
