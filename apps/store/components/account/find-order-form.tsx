"use client"

import { useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import TextInputField from "@workspace/forms/components/text-input-field"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldDescription, FieldError, FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"

import { findOrderAction } from "@/lib/actions/order-lookup.actions"
import { signInHref } from "@/lib/auth-redirect"
import { findOrderSchema, type FindOrderValues } from "@/lib/schemas/account.schemas"

export function FindOrderForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<FindOrderValues>({ resolver: zodResolver(findOrderSchema), defaultValues: { reference: "", email: "" } })

  async function onSubmit(values: FindOrderValues) {
    form.clearErrors("root")
    try {
      const result = await findOrderAction(values)
      if (!result.success) {
        form.setError("root", { message: result.error })
        return
      }
      setSentTo(values.email.trim())
    } catch (error) {
      console.error("Order lookup failed:", error)
      form.setError("root", { message: "We couldn't look that up right now. Please try again." })
    }
  }

  if (sentTo) {
    return (
      <Card>
        <CardHeader className="text-center">
          <MailCheck className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            If we have an order with that reference for <span className="font-medium text-foreground">{sentTo}</span>, we&apos;ve sent a link to it there. It can take a minute or two, and we send one
            every 10 minutes at most, so look for an earlier email too.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => setSentTo(null)}>
            Look up another order
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Find your order</CardTitle>
        <CardDescription>Enter the reference from your order confirmation and the email you ordered with. We&apos;ll email you a link to it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <TextInputField control={form.control} name="reference" label="Order reference" placeholder="BS42-20261020-00001" autoComplete="off" autoFocus />
            <TextInputField control={form.control} name="email" label="Email" type="email" placeholder="m@example.com" autoComplete="email" />
            {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}
            <Field>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner />}
                Email me a link
              </Button>
              <FieldDescription className="text-center">
                Have an account? <Link href={signInHref("/sign-in", "/account/orders")}>Sign in</Link> to see your orders.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
