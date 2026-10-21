"use client"

import { useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { storeAuthClient } from "@workspace/auth/store-client"
import PasswordField from "@workspace/forms/components/password-field"
import TextInputField from "@workspace/forms/components/text-input-field"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldSeparator } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"

import { GoogleButton } from "@/components/account/google-button"
import { LegalConsent, type LegalLinks } from "@/components/legal-consent"
import { signInHref, verifyEmailHref } from "@/lib/auth-redirect"
import { signUpSchema, type SignUpValues } from "@/lib/schemas/account.schemas"

// Signing up sends a link to confirm the email, which signs the customer in. An email that already has an account gets
// the same answer (and no email), so the form can't be used to find out who has one.
export function SignUpForm({ redirectTo, googleEnabled, legal }: { redirectTo: string; googleEnabled: boolean; legal: LegalLinks }) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "failed">("idle")
  const form = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema), defaultValues: { name: "", email: "", password: "", confirmPassword: "" } })
  const callbackURL = verifyEmailHref(redirectTo)

  async function onSubmit(values: SignUpValues) {
    form.clearErrors("root")
    try {
      // Marketing emails are off until the customer turns them on
      const result = await storeAuthClient.signUp.email({ name: values.name.trim(), email: values.email.trim(), password: values.password, getMarketingEmails: false, callbackURL })
      if (result.error) {
        form.setError("root", {
          message: result.error.status === 429 ? "Too many attempts. Please wait a minute and try again." : (result.error.message ?? "We couldn't create your account. Please try again."),
        })
        return
      }
      setSentTo(values.email.trim())
    } catch (error) {
      console.error("Storefront sign-up failed:", error)
      form.setError("root", { message: "We couldn't create your account right now. Please try again." })
    }
  }

  async function resendLink() {
    if (!sentTo) return
    setResend("sending")
    const result = await storeAuthClient.sendVerificationEmail({ email: sentTo, callbackURL }).catch(() => null)
    setResend(result && !result.error ? "sent" : "failed")
  }

  if (sentTo) {
    return (
      <Card>
        <CardHeader className="text-center">
          <MailCheck className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            We&apos;ve sent a link to <span className="font-medium text-foreground">{sentTo}</span>. Open it to confirm your address, and you&apos;ll be signed in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <Button variant="outline" onClick={() => void resendLink()} disabled={resend === "sending" || resend === "sent"}>
                {resend === "sending" && <Spinner />}
                {resend === "sent" ? "Sent again" : "Send the link again"}
              </Button>
              {resend === "failed" && (
                <p role="alert" className="text-sm text-destructive">
                  We couldn&apos;t send it. Please wait a minute and try again.
                </p>
              )}
              <FieldDescription className="text-center">
                Already confirmed? <Link href={signInHref("/sign-in", redirectTo)}>Sign in</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Track your orders and check out faster</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              {googleEnabled && (
                <>
                  <Field>
                    <GoogleButton redirectTo={redirectTo} label="Sign up with Google" />
                  </Field>
                  <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">Or continue with</FieldSeparator>
                </>
              )}
              <TextInputField control={form.control} name="name" label="Full name" placeholder="Ama Mensah" autoComplete="name" autoFocus />
              <TextInputField control={form.control} name="email" label="Email" type="email" placeholder="m@example.com" autoComplete="email" />
              <Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <PasswordField control={form.control} name="password" label="Password" autoComplete="new-password" />
                  <PasswordField control={form.control} name="confirmPassword" label="Confirm password" autoComplete="new-password" />
                </div>
                <FieldDescription>Must be at least 8 characters long.</FieldDescription>
              </Field>
              {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}
              <Field>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Spinner />}
                  Create account
                </Button>
                <FieldDescription className="text-center">
                  Already have an account? <Link href={signInHref("/sign-in", redirectTo)}>Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      {/* Below the card, as in shadcn's signup-03; Google sign-up agrees to the same */}
      <LegalConsent action="creating an account" links={legal} className="px-6 text-center" />
    </>
  )
}
