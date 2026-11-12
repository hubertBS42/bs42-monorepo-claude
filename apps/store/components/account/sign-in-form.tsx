"use client"

import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { storeAuthClient } from "@workspace/auth/store-client"
import PasswordField from "@workspace/forms/components/password-field"
import TextInputField from "@workspace/forms/components/text-input-field"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FormAlert, formAlertTone } from "@workspace/forms/components/form-alert"
import { Field, FieldDescription, FieldGroup, FieldSeparator } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"

import { GoogleButton } from "@/components/account/google-button"
import { signInHref } from "@/lib/auth-redirect"
import { signInSchema, type SignInValues } from "@/lib/schemas/account.schemas"

export function SignInForm({ redirectTo, googleEnabled, notice }: { redirectTo: string; googleEnabled: boolean; notice: string | null }) {
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } })

  async function onSubmit(values: SignInValues) {
    form.clearErrors("root")
    try {
      // Better Auth uses callbackURL twice: the browser goes there once signed in (a full page load, so the header and
      // the basket, which may have joined the account's, start afresh), and when the address isn't confirmed yet, the
      // new link it emails signs the customer in there
      const result = await storeAuthClient.signIn.email({ email: values.email, password: values.password, callbackURL: redirectTo })
      if (result.error) {
        // Not a failure: the customer has a step to take
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          form.setError("root", { type: "notice", message: "Confirm your email address first. We've sent you a new link: open it and you'll be signed in." })
          return
        }
        const message =
          result.error.code === "BANNED_USER"
            ? "This account has been suspended. Please contact us."
            : result.error.status === 429
              ? "Too many attempts. Please wait a minute and try again."
              : "Wrong email or password. Please try again."
        form.setError("root", { message })
      }
    } catch (error) {
      console.error("Storefront sign-in failed:", error)
      form.setError("root", { message: "We couldn't sign you in right now. Please try again." })
    }
  }

  const rootError = form.formState.errors.root
  const rootTone = rootError && formAlertTone(rootError)

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>{googleEnabled ? "Sign in with your Google account or your email" : "Sign in with your email and password"}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            {/* Google sign-in that came back with an error */}
            {notice && <FormAlert title="Couldn't sign you in">{notice}</FormAlert>}
            {googleEnabled && (
              <>
                <Field>
                  <GoogleButton redirectTo={redirectTo} label="Sign in with Google" />
                </Field>
                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">Or continue with</FieldSeparator>
              </>
            )}
            <TextInputField control={form.control} name="email" label="Email" type="email" placeholder="m@example.com" autoComplete="email" autoFocus />
            <PasswordField
              control={form.control}
              name="password"
              label="Password"
              autoComplete="current-password"
              resetPasswordSlot={
                <Link href="/forgot-password" className="ml-auto text-sm underline-offset-4 hover:underline">
                  Forgot your password?
                </Link>
              }
            />
            {rootError && (
              <FormAlert title={rootTone === "notice" ? "Check your email" : "Couldn't sign you in"} tone={rootTone}>
                {rootError.message}
              </FormAlert>
            )}
            <Field>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner />}
                Sign in
              </Button>
              <FieldDescription className="text-center">
                Don&apos;t have an account? <Link href={signInHref("/sign-up", redirectTo)}>Sign up</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
