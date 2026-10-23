"use client"

import { useEffect, useState } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { DiscountType } from "@workspace/db/enums"
import { NumberInputField, SelectField, TextInputField } from "@workspace/forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrency } from "@workspace/utils/currency"
import { previewQuoteAction } from "@/lib/actions/quote.actions"
import type { QuoteCustomer, QuotePreview } from "@/types"
import type { QuoteFormInput, QuoteFormOutput } from "../quote-form"

const discountOptions = [
  { label: "No discount", value: "NONE" },
  { label: "Fixed amount (GH₵)", value: DiscountType.FIXED },
  { label: "Percentage", value: DiscountType.PERCENTAGE },
]

const ghs = (amount: string) => formatCurrency(amount, "GHS", "en-GH")

const TotalRow = ({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) => (
  <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-sm"}>
    <span className={strong ? undefined : "text-muted-foreground"}>{label}</span>
    <span>{amount}</span>
  </div>
)

export default function ReviewStep({ form, customer }: { form: UseFormReturn<QuoteFormInput, unknown, QuoteFormOutput>; customer: QuoteCustomer | null }) {
  const values = useWatch({ control: form.control })
  const [preview, setPreview] = useState<QuotePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const { items = [], shippingRegion = "", shippingTown = "", shippingGhs, discountType = "NONE", discountValue } = values
  const discountReady = discountType === "NONE" || (typeof discountValue === "number" && discountValue > 0)
  // A stable key, so the preview only reloads when something that changes the price does
  const pricingKey = JSON.stringify({ items, shippingRegion, shippingTown, shippingGhs, discountType, discountValue })

  // The server prices the quotation the same way it will when it's saved, a moment after the last change
  useEffect(() => {
    if (!discountReady || typeof shippingGhs !== "number") return
    let isCurrent = true
    const timer = setTimeout(() => {
      previewQuoteAction({
        items: items.map((item) => ({ listingId: item.listingId!, listingVariantId: item.listingVariantId ?? null, quantity: Number(item.quantity), installation: !!item.installation })),
        shippingRegion,
        shippingTown,
        shippingGhs,
        discountType,
        discountValue: typeof discountValue === "number" ? discountValue : 0,
      })
        .then((response) => {
          if (!isCurrent) return
          if (response.success) {
            setPreview(response.data)
            setPreviewError(null)
          } else {
            setPreview(null)
            setPreviewError(response.error)
          }
        })
        .catch(() => isCurrent && setPreviewError("Unable to price the quotation."))
    }, 400)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
    // pricingKey covers the items, the area, the delivery fee and the discount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingKey, discountReady])

  const address = [values.shippingLine1, values.shippingLine2, values.shippingTown, values.shippingRegion].filter(Boolean).join(", ")

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>
            {preview ? `In GHS at GH₵${Number(preview.exchangeRate)} per $1. Sending it prices the quotation again, and its prices then hold.` : "Pricing the quotation…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {previewError ? (
            <p className="text-sm text-destructive">{previewError}</p>
          ) : !preview ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.lines.map((line) => (
                    <TableRow key={line.key}>
                      <TableCell className="whitespace-normal">
                        <div className="grid">
                          <span>{line.label}</span>
                          {line.installationGhs && <span className="text-xs text-muted-foreground">{`Installation ${ghs(line.installationGhs)}`}</span>}
                          {line.stock !== null && line.quantity > line.stock && (
                            <span className="text-xs text-amber-600 dark:text-amber-500">{`Only ${line.stock} in stock now: it must be in stock when the quotation is accepted`}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">{ghs(line.unitPriceGhs)}</TableCell>
                      <TableCell className="text-right">{ghs(line.totalPriceGhs)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="ml-auto grid w-full max-w-xs gap-1.5">
                <TotalRow label="Subtotal" amount={ghs(preview.subtotalGhs)} />
                {preview.discountAmountGhs && Number(preview.discountAmountGhs) > 0 && <TotalRow label="Discount" amount={`−${ghs(preview.discountAmountGhs)}`} />}
                {Number(preview.installationGhs) > 0 && <TotalRow label="Installation" amount={ghs(preview.installationGhs)} />}
                <TotalRow label="Delivery" amount={Number(preview.shippingGhs) > 0 ? ghs(preview.shippingGhs) : "Free"} />
                <TotalRow label={Number(preview.taxRate) ? `Tax (${+(Number(preview.taxRate) * 100).toFixed(2)}%)` : "Tax"} amount={ghs(preview.taxGhs)} />
                <Separator className="my-1" />
                <TotalRow label="Total" amount={ghs(preview.totalGhs)} strong />
              </div>
            </>
          )}

          <Separator />
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="grid gap-1">
              <p className="text-xs text-muted-foreground">For</p>
              <p className="font-medium">{customer?.trade ? `${values.customerName}, ${customer.trade.companyName}` : values.customerName}</p>
              <p className="text-muted-foreground">{[values.customerEmail, values.customerPhone].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs text-muted-foreground">Delivery</p>
              <p className="font-medium">{address}</p>
              <p className="text-muted-foreground">{`Prices hold for ${values.validityDays} ${values.validityDays === 1 ? "day" : "days"}`}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discount</CardTitle>
          <CardDescription>{customer?.trade ? "Starts at their trade discount. Split across the items, before tax." : "Split across the items, before tax."}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SelectField control={form.control} name="discountType" aria-label="Discount" options={discountOptions} />
            {discountType !== "NONE" && (
              <>
                <NumberInputField
                  control={form.control}
                  label={discountType === DiscountType.PERCENTAGE ? "Percentage" : "Amount"}
                  name="discountValue"
                  step={0.01}
                  min={0}
                  prependText={discountType === DiscountType.PERCENTAGE ? "%" : "GH₵"}
                />
                <TextInputField control={form.control} label="Reason" name="discountReason" placeholder="Shown on the quotation" />
              </>
            )}
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}
