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
import { findQuoteCustomerAction } from "@/lib/actions/quote.actions"
import type { QuoteCustomer } from "@/types"
import { tradeDiscountReason, type QuoteFormInput, type QuoteFormOutput } from "../quote-form"

// An exact email or phone number: staff can't browse the platform's customers
const lookupSchema = z.object({
  email: z.string().trim(),
  phone: z.string(),
})

interface CustomerStepProps {
  form: UseFormReturn<QuoteFormInput, unknown, QuoteFormOutput>
  customer: QuoteCustomer | null
  onCustomerChange: (customer: QuoteCustomer | null) => void
}

export default function CustomerStep({ form, customer, onCustomerChange }: CustomerStepProps) {
  const [isSearching, startSearch] = useTransition()
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const lookup = useForm<z.infer<typeof lookupSchema>>({ resolver: zodResolver(lookupSchema), defaultValues: { email: "", phone: "" } })

  // A trade account's discount is where the review step starts; staff can change it
  const setTradeDiscount = (trade: QuoteCustomer["trade"]) => {
    const current = form.getValues()
    const isTradeDiscount = current.discountType === "NONE" || current.discountReason.startsWith("Trade discount")
    if (!isTradeDiscount) return
    if (trade) {
      form.setValue("discountType", "PERCENTAGE")
      form.setValue("discountValue", Number(trade.percent))
      form.setValue("discountReason", tradeDiscountReason(trade.percent))
    } else {
      form.setValue("discountType", "NONE")
      form.setValue("discountValue", 0)
      form.setValue("discountReason", "")
    }
  }

  const applyCustomer = (found: QuoteCustomer) => {
    onCustomerChange(found)
    form.setValue("customerUserId", found.id)
    form.setValue("customerName", found.name ?? "")
    form.setValue("customerEmail", found.email)
    form.setValue("customerPhone", found.phone ?? "")
    form.clearErrors(["customerName", "customerEmail", "customerPhone"])
    setTradeDiscount(found.trade)
  }

  const unlink = () => {
    onCustomerChange(null)
    form.setValue("customerUserId", null)
    setTradeDiscount(null)
  }

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
        setLookupMessage("No customer has that email or phone number. Fill in their details below: they can accept the quotation once they create an account with that email.")
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
          {/* A div, not a form: it sits inside the quotation's form, and forms can't nest */}
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
            {customer
              ? `${customer.email}'s account${customer.trade ? `, a trade account for ${customer.trade.companyName} with ${Number(customer.trade.percent)}% off` : ""}.`
              : "The quotation is emailed here. Whoever signs in with this email, once it's confirmed, can accept it."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FieldGroup>
            <TextInputField control={form.control} label="Name" name="customerName" />
            <TextInputField control={form.control} label="Email" name="customerEmail" type="email" />
            <PhoneField control={form.control} label="Phone" name="customerPhone" defaultCountry="GH" />
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
