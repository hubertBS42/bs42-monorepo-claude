"use client"

import { useEffect, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { PhoneField, TextInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { findQuoteCustomerAction } from "@/lib/actions/quote.actions"
import type { QuoteCustomer } from "@/types"
import { asStaffSaleForm, setTradeDiscount, unlinkCustomer, type StaffSaleFields, type StaffSaleForm, type StaffSaleKind } from "./form"

// An exact email or phone number: staff can't browse the platform's customers
const lookupSchema = z.object({
  email: z.string().trim(),
  phone: z.string(),
})

const COPY = {
  quote: {
    notFound: "No customer has that email or phone number. Fill in their details below: they can accept the quotation once they create an account with that email.",
    details: "The quotation is emailed here. Whoever signs in with this email, once it's confirmed, can accept it.",
  },
  order: {
    notFound: "No customer has that email or phone number. Fill in their details below.",
    details: "Emails about the order go here. Without an email the customer gets none.",
  },
}

interface CustomerStepProps<T extends StaffSaleFields, O> {
  kind: StaffSaleKind
  form: StaffSaleForm<T, O>
  customer: QuoteCustomer | null
  onCustomerChange: (customer: QuoteCustomer | null) => void
}

// The customer: looked up by exact email or phone (their saved addresses and any trade discount), or typed in
export default function CustomerStep<T extends StaffSaleFields, O>({ kind, form: wizardForm, customer, onCustomerChange }: CustomerStepProps<T, O>) {
  const form = asStaffSaleForm(wizardForm)
  // A quotation is emailed, and its email decides who can accept it; an order can be for a customer with neither
  const isOptional = kind === "order"
  const [isSearching, startSearch] = useTransition()
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const lookup = useForm<z.infer<typeof lookupSchema>>({ resolver: zodResolver(lookupSchema), defaultValues: { email: "", phone: "" } })

  const applyCustomer = (found: QuoteCustomer) => {
    onCustomerChange(found)
    form.setValue("customerUserId", found.id)
    form.setValue("customerName", found.name ?? "")
    form.setValue("customerEmail", found.email)
    form.setValue("customerPhone", found.phone ?? "")
    form.clearErrors(["customerName", "customerEmail", "customerPhone"])
    setTradeDiscount(form, found.trade)
  }

  const unlink = () => {
    onCustomerChange(null)
    unlinkCustomer(wizardForm)
  }

  // The account goes with its email: an order's emails, or who can accept a quotation, follow the address typed here,
  // so a different one is someone else's. Only on typing: looking a customer up sets the email too.
  useEffect(() => {
    if (!customer) return
    const { unsubscribe } = form.watch((values, { name, type }) => {
      if (name !== "customerEmail" || type !== "change" || values.customerEmail?.trim().toLowerCase() === customer.email.toLowerCase()) return
      onCustomerChange(null)
      unlinkCustomer(wizardForm)
      setLookupMessage(`No longer linked to ${customer.email}'s account: the email is different now.`)
    })
    return unsubscribe
  }, [customer, form, onCustomerChange, wizardForm])

  const handleFind = lookup.handleSubmit(({ email, phone }) => {
    setLookupMessage(null)
    if (!email && !phone) {
      setLookupMessage("Enter an email or a phone number.")
      return
    }
    startSearch(async () => {
      const response = await findQuoteCustomerAction({ email, phone })
      if (!response.success) {
        setLookupMessage(response.error)
        return
      }
      if (!response.data) {
        setLookupMessage(COPY[kind].notFound)
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
          <CardDescription>Look them up by their exact email or phone number to use their saved addresses and any trade discount.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* A div, not a form: it sits inside the wizard's form, and forms can't nest */}
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
            {customer ? `${customer.email}'s account${customer.trade ? `, a trade account for ${customer.trade.companyName} with ${Number(customer.trade.percent)}% off` : ""}.` : COPY[kind].details}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FieldGroup>
            <TextInputField control={form.control} label="Name" name="customerName" />
            <TextInputField control={form.control} label={isOptional ? "Email (optional)" : "Email"} name="customerEmail" type="email" />
            <PhoneField control={form.control} label={isOptional ? "Phone (optional)" : "Phone"} name="customerPhone" defaultCountry="GH" />
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
