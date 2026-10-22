"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import PhoneField from "@workspace/forms/components/phone-field"
import SelectField from "@workspace/forms/components/select-field"
import TextInputField from "@workspace/forms/components/text-input-field"
import TextareaField from "@workspace/forms/components/textarea-field"
import { BUSINESS_TYPE_OPTIONS } from "@workspace/commerce/trade-account-status"
import { Button } from "@workspace/ui/components/button"
import { FieldError } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { applyForTradeAccountAction } from "@/lib/actions/trade.actions"
import { tradeApplicationSchema, type TradeApplicationValues } from "@/lib/schemas/trade.schemas"

// Applying for a trade account, or again after a rejection with the details filled in from the last time
export function TradeApplicationForm({ initial }: { initial: TradeApplicationValues }) {
  const router = useRouter()
  const form = useForm<TradeApplicationValues, unknown, z.output<typeof tradeApplicationSchema>>({ resolver: zodResolver(tradeApplicationSchema), defaultValues: initial })
  const { isSubmitting } = form.formState

  async function onSubmit(values: z.output<typeof tradeApplicationSchema>) {
    form.clearErrors("root")
    try {
      const result = await applyForTradeAccountAction(values)
      if (!result.success) {
        form.setError("root", { message: result.error })
        if (result.code === "UNAUTHORIZED" || result.code === "ALREADY_APPLIED") router.refresh()
        return
      }
      toast.add({ title: "Application sent", description: "We'll email you once we've reviewed it.", type: "success" })
      router.refresh()
    } catch (error) {
      console.error("Applying for a trade account failed:", error)
      form.setError("root", { message: "We couldn't send that just now. Please try again." })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <TextInputField control={form.control} name="companyName" label="Company name" autoComplete="organization" disabled={isSubmitting} />
      </div>
      <TextInputField control={form.control} name="registrationNumber" label="Registration number" description="From the Office of the Registrar of Companies" disabled={isSubmitting} />
      <TextInputField control={form.control} name="tin" label="TIN" description="Printed on your invoices" disabled={isSubmitting} />
      <PhoneField control={form.control} name="phone" label="Business phone" defaultCountry="GH" disabled={isSubmitting} />
      <SelectField control={form.control} name="businessType" label="What the business does" options={BUSINESS_TYPE_OPTIONS} placeholder="Choose one" disabled={isSubmitting} />
      <div className="sm:col-span-2">
        <TextareaField
          control={form.control}
          name="details"
          label="Tell us about the business (optional)"
          placeholder="What you install or sell, and roughly how much you buy"
          rows={3}
          disabled={isSubmitting}
        />
      </div>
      {form.formState.errors.root && (
        <div className="sm:col-span-2">
          <FieldError errors={[form.formState.errors.root]} />
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Send application
        </Button>
      </div>
    </form>
  )
}
