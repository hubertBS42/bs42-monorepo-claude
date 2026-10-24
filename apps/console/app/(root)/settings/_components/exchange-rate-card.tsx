"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { SubmitHandler, useForm } from "react-hook-form"
import { z } from "zod"
import { Save } from "lucide-react"
import { NumberInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { InfoTip } from "@workspace/ui/components/info-tip"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { formatDate } from "@workspace/utils/date"
import { setTodaysExchangeRateAction } from "@/lib/actions/exchange-rate.actions"
import type { ExchangeRateInfo } from "@workspace/commerce/exchange-rates"
import { exchangeRateFormSchema } from "@/lib/schemas/exchange-rate.schemas"

type FormValues = z.infer<typeof exchangeRateFormSchema>

// Its own form, saved apart from the settings row: a rate is saved per day and orders keep the one they used
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
        <CardTitle className="flex items-center gap-1.5">
          Exchange Rate
          <InfoTip about="Exchange Rate">
            Fetched from Open Exchange Rates after midnight, Accra time, with the markup added. A rate set here is used as typed. A day's rate can't change once an order or quotation has used it.
          </InfoTip>
        </CardTitle>
        <CardDescription>{`Fetched daily. Set it here to override today's. Orders need one under ${maxAgeDays} days old.`}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* stopPropagation keeps a submit from reaching any form around it */}
        <form
          onSubmit={(e) => {
            e.stopPropagation()
            form.handleSubmit(onSubmit)(e)
          }}
          className="grid gap-4"
        >
          <p className={latest?.isStale || !latest ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {latest
              ? `Latest: GH₵${Number(latest.rate)} per $1 for ${formatDate(`${latest.date}T12:00:00Z`, "MMM d, yyyy")}, ${latest.source === "MANUAL" ? "set by hand" : `fetched from Open Exchange Rates${latest.marketRate && latest.marketRate !== latest.rate ? ` (market rate GH₵${Number(latest.marketRate)}, plus the markup)` : ""}`}.${latest.isStale ? " It's too old for new orders." : ""}`
              : "No rate has been set, so no order can be priced yet."}
          </p>
          {/* The field rounds to its step when it loses focus, so the step matches the six decimals rates are stored
              (and fetched) with: a coarser one would change a fetched rate just by clicking in and out */}
          <NumberInputField control={form.control} label="Today's rate (GHS per $1)" name="rate" step={0.000001} min={0} prependText="GH₵" disabled={isPending} />
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending || !form.formState.isDirty}>
              {isPending ? (
                <Spinner />
              ) : (
                <>
                  <Save /> Save
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
