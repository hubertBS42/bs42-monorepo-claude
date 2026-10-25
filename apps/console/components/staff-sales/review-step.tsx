"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useWatch } from "react-hook-form"
import { DiscountType } from "@workspace/db/enums"
import { NumberInputField, SelectField, TextInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrency } from "@workspace/utils/currency"
import { previewQuoteAction } from "@/lib/actions/quote.actions"
import type { QuoteCustomer, QuotePreview } from "@/types"
import { asStaffSaleForm, type StaffSaleFields, type StaffSaleForm, type StaffSaleKind } from "./form"
import { formatPhoneNumber } from "@workspace/utils/phone"

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

const COPY = {
  quote: {
    priced: "Prices are checked again when it's sent.",
    pricing: "Pricing the quotation…",
    unpriced: "Unable to price the quotation.",
    overStock: (stock: number) => `Only ${stock} in stock now: it must be in stock when the quotation is accepted`,
    reasonPlaceholder: "Shown on the quotation",
  },
  order: {
    priced: "Stock is reserved when it's created.",
    pricing: "Pricing the order…",
    unpriced: "Unable to price the order.",
    overStock: (stock: number) => `Only ${stock} in stock now: the order can't take more`,
    reasonPlaceholder: "Shown on the invoice",
  },
}

interface ReviewStepProps<T extends StaffSaleFields, O> {
  kind: StaffSaleKind
  form: StaffSaleForm<T, O>
  customer: QuoteCustomer | null
  // Under the address: the quotation's validity, or how the customer will pay for the order
  terms: ReactNode
  // Settings' free-delivery threshold, so the step can offer it when the order reaches it
  freeDeliveryFromGhs: string | null
  // Each new price, and null while it's being priced again, for a wizard that sends the total it showed
  onPreviewChange?: (preview: QuotePreview | null) => void
  // Changed by the wizard to price it again with nothing else changed (after a PRICE_CHANGED refusal)
  refreshKey?: number
}

// Amounts as whole pesewas, to compare them without floating-point surprises
const pesewas = (amount: string) => Math.round(Number(amount) * 100)

// The prices, from the server, with the discount
export default function ReviewStep<T extends StaffSaleFields, O>({ kind, form: wizardForm, customer, terms, freeDeliveryFromGhs, onPreviewChange, refreshKey = 0 }: ReviewStepProps<T, O>) {
  const form = asStaffSaleForm(wizardForm)
  const copy = COPY[kind]
  const values = useWatch({ control: form.control })
  const [preview, setPreview] = useState<QuotePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const { items = [], shippingRegion = "", shippingTown = "", shippingGhs, discountType = "NONE", discountValue } = values
  const discountReady = discountType === "NONE" || (typeof discountValue === "number" && discountValue > 0)
  // A stable key, so the preview only reloads when something that changes the price does
  const pricingKey = JSON.stringify({ items, shippingRegion, shippingTown, shippingGhs, discountType, discountValue })

  // The server prices it the same way it will when it's saved, a moment after the last change
  useEffect(() => {
    // The total shown is out of date until the new one arrives
    onPreviewChange?.(null)
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
            onPreviewChange?.(response.data)
          } else {
            setPreview(null)
            setPreviewError(response.error)
          }
        })
        .catch(() => isCurrent && setPreviewError(copy.unpriced))
    }, 400)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
    // pricingKey covers the items, the area, the delivery fee and the discount; copy follows kind and the callback is
    // the wizard's state setter, neither of which changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingKey, discountReady, refreshKey])

  // Free delivery counts the goods after the discount, as on the storefront. Staff set the fee, so it's offered, not
  // applied.
  const reachesFreeDelivery =
    !!preview && freeDeliveryFromGhs !== null && pesewas(preview.shippingGhs) > 0 && pesewas(preview.subtotalGhs) - pesewas(preview.discountAmountGhs ?? "0") >= pesewas(freeDeliveryFromGhs)

  const address = [values.shippingLine1, values.shippingLine2, values.shippingTown, values.shippingRegion].filter(Boolean).join(", ")

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>{preview ? `In GHS at GH₵${Number(preview.exchangeRate)} per $1. ${copy.priced}` : copy.pricing}</CardDescription>
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
                          {line.stock !== null && line.quantity > line.stock && <span className="text-xs text-amber-600 dark:text-amber-500">{copy.overStock(line.stock)}</span>}
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
              {reachesFreeDelivery && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                  <span className="text-muted-foreground">{`Qualifies for free delivery (${ghs(freeDeliveryFromGhs!)} or more after discount).`}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => form.setValue("shippingGhs", 0, { shouldDirty: true })}>
                    Deliver free
                  </Button>
                </div>
              )}
            </>
          )}

          <Separator />
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="grid gap-1">
              <p className="text-xs text-muted-foreground">For</p>
              <p className="font-medium">{customer?.trade ? `${values.customerName}, ${customer.trade.companyName}` : values.customerName}</p>
              <p className="text-muted-foreground">{[values.customerEmail, values.customerPhone && formatPhoneNumber(values.customerPhone)].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs text-muted-foreground">Delivery</p>
              <p className="font-medium">{address}</p>
              <p className="text-muted-foreground">{terms}</p>
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
                <TextInputField control={form.control} label="Reason" name="discountReason" placeholder={copy.reasonPlaceholder} />
              </>
            )}
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}
