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
import type { QuoteCustomer } from "@/types"
import type { OrderFormInput, OrderFormOutput } from "../../orders/create/_components/create-order-form"

// An exact email or phone number: staff can't browse the platform's customers
const lookupSchema = z.object({ email: z.string().trim(), phone: z.string() })

interface CustomerCardProps {
  storeId: string
  form: UseFormReturn<OrderFormInput, unknown, OrderFormOutput>
  customer: QuoteCustomer | null
  onCustomerChange: (customer: QuoteCustomer | null) => void
}

// Optional: a walk-in needs none of it. Finding an account links the sale to it, with its trade discount.
export default function CustomerCard({ storeId, form, customer, onCustomerChange }: CustomerCardProps) {
  const [isSearching, startSearch] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const lookup = useForm<z.infer<typeof lookupSchema>>({ resolver: zodResolver(lookupSchema), defaultValues: { email: "", phone: "" } })

  const find = lookup.handleSubmit(({ email, phone }) => {
    setMessage(null)
    if (!email && !phone) {
      setMessage("Enter an email or a phone number.")
      return
    }
    startSearch(async () => {
      const response = await findOrderCustomerAction({ storeId, email, phone })
      if (!response.success) {
        setMessage(response.error)
        return
      }
      if (!response.data) {
        setMessage("No customer has that email or phone number.")
        return
      }
      onCustomerChange(response.data)
      form.setValue("customerUserId", response.data.id)
      form.setValue("customerName", response.data.name || "Walk-in customer")
      form.setValue("customerEmail", response.data.email)
      form.setValue("customerPhone", response.data.phone ?? "")
      form.clearErrors(["customerName", "customerEmail", "customerPhone"])
    })
  })

  const unlink = () => {
    onCustomerChange(null)
    form.setValue("customerUserId", null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer</CardTitle>
        <CardDescription>
          {customer?.trade
            ? `${customer.trade.companyName}: ${Number(customer.trade.percent)}% trade discount applied.`
            : customer
              ? `Linked to ${customer.email}'s account.`
              : "Optional. With an email they're sent a receipt."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!customer && (
          // A div, not a form: Enter here must never do anything but type
          <div className="grid gap-3">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextInputField control={lookup.control} label="Find by email" name="email" type="email" disabled={isSearching} />
              <PhoneField control={lookup.control} label="Or phone" name="phone" defaultCountry="GH" disabled={isSearching} />
            </div>
            <Button type="button" variant="outline" className="justify-self-start" onClick={() => void find()} disabled={isSearching}>
              {isSearching ? <Spinner /> : "Find customer"}
            </Button>
            {message && (
              <p role="status" className="text-sm text-muted-foreground">
                {message}
              </p>
            )}
          </div>
        )}
        <FieldGroup>
          <TextInputField control={form.control} label="Name" name="customerName" />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInputField control={form.control} label="Email (optional)" name="customerEmail" type="email" />
            <PhoneField control={form.control} label="Phone (optional)" name="customerPhone" defaultCountry="GH" />
          </div>
        </FieldGroup>
        {customer && (
          <Button type="button" variant="ghost" className="justify-self-start" onClick={unlink}>
            {customer.trade ? "Remove account and trade discount" : "Don't link to their account"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
