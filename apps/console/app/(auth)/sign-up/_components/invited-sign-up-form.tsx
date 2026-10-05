"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PasswordField, TextInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldError, FieldGroup } from "@workspace/ui/components/field"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { useRouter } from "next/navigation"
import { SubmitHandler, useForm } from "react-hook-form"
import * as z from "zod"
import { signUpInvitedUserAction } from "@/lib/actions/invitation.actions"
import { invitedSignUpFormSchema } from "@/lib/schemas/invitation.schemas"

export function InvitedSignUpForm({ invitationId, email, storeName }: { invitationId: string; email: string; storeName: string }) {
  const router = useRouter()

  const form = useForm<z.infer<typeof invitedSignUpFormSchema>>({
    resolver: zodResolver(invitedSignUpFormSchema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  })

  const onSubmit: SubmitHandler<z.infer<typeof invitedSignUpFormSchema>> = async (data) => {
    form.clearErrors("root")

    const result = await signUpInvitedUserAction({ invitationId, ...data })

    if (!result.success) {
      if (result.code === "EMAIL_EXISTS") {
        router.replace(`/login?callbackURL=${encodeURIComponent(`/accept-invitation/${invitationId}`)}`)
        return
      }
      form.setError("root", { message: result.error })
      return
    }

    const signIn = await consoleAuthClient.signIn.email({
      email,
      password: data.password,
    })

    if (signIn.error) {
      router.replace(`/login?callbackURL=${encodeURIComponent(`/accept-invitation/${invitationId}`)}`)
      return
    }

    router.replace(`/accept-invitation/${invitationId}`)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>{`You've been invited to join ${storeName}. Create an account to continue.`}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} id="invited-sign-up-form">
          <FieldGroup>
            <div className="grid gap-1 text-sm">
              <span className="font-medium">Email</span>
              <span className="text-muted-foreground">{email}</span>
            </div>

            <TextInputField
              control={form.control}
              name="name"
              label="Full name"
              autoComplete="name"
              autoFocus
              disabled={form.formState.isSubmitting}
            />
            <PasswordField
              control={form.control}
              name="password"
              label="Password"
              autoComplete="new-password"
              disabled={form.formState.isSubmitting}
            />
            <PasswordField
              control={form.control}
              name="confirmPassword"
              label="Confirm password"
              autoComplete="new-password"
              disabled={form.formState.isSubmitting}
            />

            {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating account..." : "Sign up"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
