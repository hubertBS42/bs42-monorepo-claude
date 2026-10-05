"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldError, FieldGroup } from "@workspace/ui/components/field"
import { PasswordField, TextInputField } from "@workspace/forms"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { SubmitHandler, useForm } from "react-hook-form"
import * as z from "zod"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { PLATFORM_ORGANIZATION_SLUG } from "@/constants"
import { signInFormSchema } from "@/lib/schemas/auth.schemas"

function getSafeCallbackURL(callbackURL: string) {
  if (!callbackURL.startsWith("/") || callbackURL.startsWith("//") || callbackURL.startsWith("/\\")) {
    return "/"
  }

  return callbackURL
}

export function LoginForm({ callbackURL, setupComplete = false }: { callbackURL: string; setupComplete?: boolean }) {
  const router = useRouter()
  const safeCallbackURL = getSafeCallbackURL(callbackURL)

  const form = useForm<z.infer<typeof signInFormSchema>>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit: SubmitHandler<z.infer<typeof signInFormSchema>> = async (data) => {
    form.clearErrors("root")

    try {
      const result = await consoleAuthClient.signIn.email({
        email: data.email,
        password: data.password,
      })

      if (result.error) {
        // The ban check runs after the password is verified, so showing it
        // doesn't reveal whether an account exists
        form.setError("root", {
          message:
            result.error.code === "BANNED_USER"
              ? "Your account has been suspended. Please contact an administrator."
              : "Invalid email or password. Please try again.",
        })
        return
      }

      // Invitees have no workspace yet; accepting the invitation adds one
      if (safeCallbackURL.startsWith("/accept-invitation/")) {
        router.replace(safeCallbackURL)
        router.refresh()
        return
      }

      try {
        const organizationsResult = await consoleAuthClient.organization.list()
        if (organizationsResult.error) {
          console.error("Could not load console organizations after sign-in:", organizationsResult.error)
          form.setError("root", {
            message: "You are signed in, but we couldn't load your workspaces. Please try again.",
          })
          return
        }

        const organizations = organizationsResult.data ?? []
        if (!organizations.length) {
          form.setError("root", {
            message: "Your account is not assigned to a workspace. Please contact an administrator.",
          })
          return
        }

        const activeOrganization = organizations.find((organization) => organization.slug === PLATFORM_ORGANIZATION_SLUG) ?? organizations[0]

        if (activeOrganization) {
          const activationResult = await consoleAuthClient.organization.setActive({
            organizationId: activeOrganization.id,
          })

          if (activationResult.error) {
            console.error("Could not activate the console organization after sign-in:", activationResult.error)
            form.setError("root", {
              message: "You are signed in, but we couldn't activate your workspace. Please try again.",
            })
            return
          }
        }
      } catch (error) {
        console.error("Could not initialize the console workspace after sign-in:", error)
        form.setError("root", {
          message: "You are signed in, but we couldn't activate your workspace. Please try again.",
        })
        return
      }

      router.replace(safeCallbackURL)
      router.refresh()
    } catch (error) {
      console.error("Console sign-in failed:", error)
      form.setError("root", {
        message: "Unable to sign in. Please check your credentials and try again.",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login to your account</CardTitle>
        <CardDescription>
          {setupComplete ? "Your administrator account is ready. Sign in to continue." : "Enter your email below to login to your account"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} id="sign-in-form">
          <FieldGroup>
            <TextInputField
              control={form.control}
              name="email"
              label="Email"
              type="email"
              placeholder="m@example.com"
              autoComplete="email"
              autoFocus
            />

            <PasswordField
              control={form.control}
              name="password"
              label="Password"
              placeholder="Enter your password"
              autoComplete="current-password"
              resetPasswordSlot={
                <Link href="/reset-password" className="ml-auto inline-block text-sm underline-offset-4 hover:underline">
                  Forgot your password?
                </Link>
              }
            />

            {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}

            <Button type="submit" form="sign-in-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Logging in..." : "Login"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
