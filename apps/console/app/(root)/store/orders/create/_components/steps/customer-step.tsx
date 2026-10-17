"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { PhoneField, TextInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { findOrderCustomerAction } from "@/lib/actions/store-order.actions"
import type { OrderCustomer } from "@/types"
import type { OrderFormInput, OrderFormOutput } from "../create-order-form"

// An exact email or phone number: staff can't browse the platform's customers
const lookupSchema = z.object({
  email: z.string().trim(),
  phone: z.string(),
})

interface CustomerStepProps {
  storeId: string
  form: UseFormReturn<OrderFormInput, unknown, OrderFormOutput>
  customer: OrderCustomer | null
  onCustomerChange: (customer: OrderCustomer | null) => void
}

export default function CustomerStep({ storeId, form, customer, onCustomerChange }: CustomerStepProps) {
  const [isSearching, startSearch] = useTransition()
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const lookup = useForm<z.infer<typeof lookupSchema>>({ resolver: zodResolver(lookupSchema), defaultValues: { email: "", phone: "" } })

  const applyCustomer = (found: OrderCustomer) => {
    onCustomerChange(found)
    form.setValue("customerUserId", found.id)
    form.setValue("customerName", found.name ?? "")
    form.setValue("customerEmail", found.email)
    form.setValue("customerPhone", found.phone ?? "")
    form.clearErrors(["customerName", "customerEmail", "customerPhone"])
  }

  const unlink = () => {
    onCustomerChange(null)
    form.setValue("customerUserId", null)
  }

  const handleFind = lookup.handleSubmit(({ email, phone }) => {
    setLookupMessage(null)
    if (!email && !phone) {
      setLookupMessage("Enter an email or a phone number.")
      return
    }
    startSearch(async () => {
      const response = await findOrderCustomerAction({ storeId, email, phone })
      if (!response.success) {
        setLookupMessage(response.error)
        return
      }
      if (!response.data) {
        setLookupMessage("No customer has that email or phone number. Fill in their details below for a walk-in order.")
        return
      }
      applyCustomer(response.data)
      setLookupMessage(null)
    })
  })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Find a customer</CardTitle>
          <CardDescription>Look them up by their exact email or phone number to link the order to their account and use their saved addresses.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* A div, not a form: it sits inside the order's form, and forms can't nest */}
          <div className="grid gap-4">
            <FieldGroup>
              <TextInputField control={lookup.control} label="Email" name="email" type="email" disabled={isSearching} />
              <PhoneField control={lookup.control} label="Or phone" name="phone" defaultCountry="GH" disabled={isSearching} />
            </FieldGroup>
            <Button type="button" variant="outline" onClick={() => void handleFind()} disabled={isSearching}>
              {isSearching ? <Spinner /> : "Find customer"}
            </Button>
            {lookupMessage && (
              <p role="status" className="text-sm text-muted-foreground">
                {lookupMessage}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
          <CardDescription>
            {customer ? `Linked to ${customer.email}'s account. The details are copied onto the order.` : "A walk-in customer. Without an email they won't get order emails."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FieldGroup>
            <TextInputField control={form.control} label="Name" name="customerName" />
            <TextInputField control={form.control} label="Email (optional)" name="customerEmail" type="email" />
            <PhoneField control={form.control} label="Phone (optional)" name="customerPhone" defaultCountry="GH" />
          </FieldGroup>
          {customer && (
            <Button type="button" variant="ghost" className="justify-self-start" onClick={unlink}>
              Don&apos;t link to their account
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
