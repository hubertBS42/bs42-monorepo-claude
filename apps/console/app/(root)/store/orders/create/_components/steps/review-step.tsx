"use client"

import { useEffect, useState } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { DiscountType, ShippingMethod } from "@workspace/db/enums"
import { NumberInputField, SelectField, TextInputField } from "@workspace/forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrency } from "@workspace/utils/currency"
import { useMemberRole } from "@/hooks/use-member-role"
import { previewStoreOrderAction } from "@/lib/actions/store-order.actions"
import type { OrderPreview } from "@/types"
import type { OrderFormInput, OrderFormOutput } from "../create-order-form"

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

export default function ReviewStep({ storeId, form }: { storeId: string; form: UseFormReturn<OrderFormInput, unknown, OrderFormOutput> }) {
  const values = useWatch({ control: form.control })
  const { role, isLoading } = useMemberRole(storeId)
  const [preview, setPreview] = useState<OrderPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const { items = [], shippingGhs, discountType = "NONE", discountValue } = values
  const discountReady = discountType === "NONE" || (typeof discountValue === "number" && discountValue > 0)
  // A stable key, so the preview only reloads when something that changes the price does
  const pricingKey = JSON.stringify({ items, shippingGhs, discountType, discountValue })

  // The server prices the order the same way it will when it's created, a moment after the last change
  useEffect(() => {
    if (!discountReady || typeof shippingGhs !== "number") return
    let isCurrent = true
    const timer = setTimeout(() => {
      previewStoreOrderAction({
        storeId,
        items: items.map((item) => ({ listingId: item.listingId!, listingVariantId: item.listingVariantId ?? null, quantity: Number(item.quantity) })),
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
        .catch(() => isCurrent && setPreviewError("Unable to price the order."))
    }, 400)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
    // pricingKey covers items, shippingGhs and the discount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, pricingKey, discountReady])

  // Discounts are for owners and admins; createStoreOrderAction checks again
  const canDiscount = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { order: ["update"] } })
  const isDelivery = values.shippingMethod === ShippingMethod.DELIVERY

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>{preview ? `In GHS at GH₵${Number(preview.exchangeRate)} per $1.` : "Pricing the order…"}</CardDescription>
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
                    <TableRow key={`${line.listingId}:${line.listingVariantId ?? ""}`}>
                      <TableCell>
                        <div className="grid">
                          <span>{line.label}</span>
                          {line.stock !== null && line.quantity > line.stock && <span className="text-xs text-destructive">{`Only ${line.stock} in stock`}</span>}
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
                <TotalRow label="Shipping" amount={ghs(preview.shippingGhs)} />
                <TotalRow label={Number(preview.taxRate) ? `Tax (${+(Number(preview.taxRate) * 100).toFixed(2)}%)` : "Tax"} amount={ghs(preview.taxGhs)} />
                <Separator className="my-1" />
                <TotalRow label="Total" amount={ghs(preview.totalGhs)} strong />
              </div>
            </>
          )}

          <Separator />
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="grid gap-1">
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium">{values.customerName}</p>
              <p className="text-muted-foreground">{[values.customerEmail, values.customerPhone].filter(Boolean).join(" · ") || "No contact details"}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs text-muted-foreground">{isDelivery ? "Delivery" : "Pickup"}</p>
              {isDelivery ? (
                <p className="font-medium">{[values.shippingName, values.shippingLine1, values.shippingTown, values.shippingRegion].filter(Boolean).join(", ")}</p>
              ) : (
                <p className="font-medium">Collected from the store</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discount</CardTitle>
          <CardDescription>Split across the items, before tax.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 rounded-md" />
          ) : canDiscount ? (
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
                  <TextInputField control={form.control} label="Reason" name="discountReason" placeholder="Why the discount is given" />
                </>
              )}
            </FieldGroup>
          ) : (
            // Shown as text: the fields aren't offered at all, so say why
            <p className="text-sm text-muted-foreground">Only the store&apos;s owners and admins can give discounts.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
