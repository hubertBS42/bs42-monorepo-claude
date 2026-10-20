"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import { NumberInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatDate } from "@workspace/utils/date"
import { setTodaysExchangeRateAction } from "@/lib/actions/exchange-rate.actions"
import type { ExchangeRateInfo } from "@workspace/commerce/exchange-rates"
import { exchangeRateFormSchema } from "@/lib/schemas/exchange-rate.schemas"

type FormValues = z.infer<typeof exchangeRateFormSchema>

// Its own form, not part of the settings form: a rate is saved per day and orders keep the one they used
export default function ExchangeRateCard({ latest, maxAgeDays }: { latest: ExchangeRateInfo | null; maxAgeDays: number }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(exchangeRateFormSchema),
    defaultValues: latest ? { rate: Number(latest.rate) } : {},
  })

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    startTransition(async () => {
      const response = await setTodaysExchangeRateAction(values)

      if (!response.success) {
        if (response.code === "RATE_IN_USE" || response.code === "INVALID") form.setError("rate", { type: "custom", message: response.error })
        else toast.add({ title: "Unable to save the rate", description: response.error, type: "error" })
        return
      }

      toast.add({ title: "Exchange rate saved", description: `Today's rate is GH₵${values.rate} per $1.`, type: "success" })
      form.reset(values)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exchange Rate</CardTitle>
        <CardDescription>{`Customers pay in GHS at this rate, fetched daily. Set it here to override today's. Orders refuse one over ${maxAgeDays} days old.`}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Rendered next to the settings form, not inside it; stopPropagation keeps a submit from reaching any form around it */}
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            form.handleSubmit(onSubmit)(e)
          }}
          className="grid gap-4"
        >
          <p className={latest?.isStale || !latest ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {latest
              ? `Latest: GH₵${Number(latest.rate)} per $1 for ${formatDate(`${latest.date}T12:00:00Z`, "MMM d, yyyy")}, ${latest.source === "MANUAL" ? "set by hand" : "fetched from Open Exchange Rates"}.${latest.isStale ? " It's too old for new orders." : ""}`
              : "No rate has been set, so no order can be priced yet."}
          </p>
          <div className="flex items-end gap-2">
            <div className="max-w-56 flex-1">
              {/* The field rounds to its step when it loses focus, so the step matches the six decimals rates are stored
                  (and fetched) with: a coarser one would change a fetched rate just by clicking in and out */}
              <NumberInputField control={form.control} label="Today's rate (GHS per $1)" name="rate" step={0.000001} min={0} prependText="GH₵" disabled={isPending} />
            </div>
            <Button type="submit" disabled={isPending || !form.formState.isDirty}>
              {isPending ? <Spinner /> : "Save rate"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
