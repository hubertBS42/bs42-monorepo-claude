"use client"
/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch, type SubmitHandler } from "react-hook-form"
import type { z } from "zod"
import { Search, Trash2 } from "lucide-react"
import { Currency, PurchaseOrderStatus } from "@workspace/db/enums"
import { DateField, NumberInputField, SelectField, TextareaField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"
import { formatCurrency } from "@workspace/utils/currency"
import SharedFormFooter from "@/components/shared-form-footer"
import SharedFormHeader from "@/components/shared-form-header"
import { createPurchaseOrderAction, searchPurchasableListingsAction, updatePurchaseOrderAction } from "@/lib/actions/purchase-order.actions"
import { formatCost, type SuggestedLine } from "@/lib/purchase-order-status"
import { purchaseOrderFormValuesSchema } from "@/lib/schemas/purchase-order.schemas"
import type { PurchasableListing, PurchaseOrderDetails, SelectItem } from "@/types"

// One form for creating a purchase order and editing it. A draft can change in every way; once ordered, the supplier
// and currency stay, and a line keeps at least what has come in. The action checks all of it again.

type FormInput = z.input<typeof purchaseOrderFormValuesSchema>
type FormOutput = z.output<typeof purchaseOrderFormValuesSchema>

interface LineInfo {
  label: string
  sku: string | null
  // Null when the row doesn't track stock
  stock: number | null
  // On other open purchase orders; unknown for the order's own saved lines
  incoming: number | null
  received: number
}

interface PurchaseOrderFormProps {
  storeId: string
  suppliers: SelectItem[]
  // The latest usable USD→GHS rate (GHS per 1 USD), for costs in GHS; null when there's none
  rate: string | null
  // Null when creating
  order: PurchaseOrderDetails | null
  // A new order's starting lines, for listings picked on the listings table
  suggested?: SuggestedLine[]
}

const lineKey = (listingId: string, listingVariantId: string | null) => `${listingId}:${listingVariantId ?? ""}`
const currencyOptions = [
  { value: Currency.USD, label: "US dollars (USD)" },
  { value: Currency.GHS, label: "Ghana cedis (GHS)" },
]

// A plain day (yyyy-MM-dd) as a local date for the date field, and back
const toLocalDate = (day: string) => {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(year!, month! - 1, date)
}
const toDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

// Display only: costs have two decimal places, so they add up exactly in cents
const toCents = (value: unknown) => Math.round((Number(value) || 0) * 100)

// The listing row's label, as the search results and the saved lines show it
const rowLabel = (productName: string, variantDescription: string | null) => (variantDescription ? `${productName} (${variantDescription})` : productName)

export default function PurchaseOrderForm({ storeId, suppliers, rate, order, suggested = [] }: PurchaseOrderFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // isPending turns false once the action returns, while the next page is still loading
  const [isSaved, setIsSaved] = useState(false)
  const isDraft = !order || order.status === PurchaseOrderStatus.DRAFT
  const backTo = order ? `/store/purchase-orders/${order.id}/details` : "/store/purchase-orders"

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(purchaseOrderFormValuesSchema),
    defaultValues: {
      supplierId: order?.supplier.id ?? "",
      currency: order?.currency ?? Currency.USD,
      shippingCost: Number(order?.shippingCost ?? 0),
      expectedOn: order?.expectedOn ? toLocalDate(order.expectedOn) : null,
      notes: order?.notes ?? "",
      // A new order is in USD to start with, so a suggested line starts at its last buy price as it is
      lines:
        order?.lines.map((line) => ({ id: line.id, listingId: line.listingId, listingVariantId: line.listingVariantId, quantity: line.quantityOrdered, unitCost: Number(line.unitCost) })) ??
        suggested.map(({ listing, row, quantity }) => ({ listingId: listing.listingId, listingVariantId: row.listingVariantId, quantity, unitCost: Number(row.buyPriceUsd ?? 0) })),
    },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" })
  const lines = useWatch({ control: form.control, name: "lines" })
  const currency = useWatch({ control: form.control, name: "currency" })
  const shippingCost = useWatch({ control: form.control, name: "shippingCost" })

  const [lineInfo, setLineInfo] = useState<Record<string, LineInfo>>(() =>
    Object.fromEntries([
      ...(order?.lines ?? []).map((line) => [
        lineKey(line.listingId, line.listingVariantId),
        { label: rowLabel(line.productName, line.variantDescription), sku: line.sku, stock: line.stock, incoming: null, received: line.quantityReceived },
      ]),
      ...suggested.map(({ listing, row }) => [
        lineKey(listing.listingId, row.listingVariantId),
        { label: rowLabel(listing.productName, row.variantDescription), sku: row.sku, stock: row.stock, incoming: row.incoming, received: 0 },
      ]),
    ])
  )

  // The store's listings, searched as the user types, a moment after they stop; the latest search wins
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<PurchasableListing[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  useEffect(() => {
    let isCurrent = true
    const timer = setTimeout(() => {
      searchPurchasableListingsAction({ storeId, search })
        .then((response) => {
          if (!isCurrent) return
          if (response.success) {
            setResults(response.data)
            setSearchError(null)
          } else setSearchError(response.error)
        })
        .catch(() => isCurrent && setSearchError("Unable to search the store's listings."))
    }, 300)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [storeId, search])

  const added = new Set((lines ?? []).map((line) => lineKey(line.listingId, line.listingVariantId)))

  // A new line starts at the last buy price, converted for an order in GHS when there's a rate
  const startingCost = (buyPriceUsd: string | null) => {
    if (!buyPriceUsd) return 0
    if (currency === Currency.USD) return Number(buyPriceUsd)
    return rate ? Math.round(Number(buyPriceUsd) * Number(rate) * 100) / 100 : 0
  }

  const addRow = (listing: PurchasableListing, row: PurchasableListing["rows"][number]) => {
    setLineInfo({
      ...lineInfo,
      [lineKey(listing.listingId, row.listingVariantId)]: {
        label: rowLabel(listing.productName, row.variantDescription),
        sku: row.sku,
        stock: row.stock,
        incoming: row.incoming,
        received: 0,
      },
    })
    append({ listingId: listing.listingId, listingVariantId: row.listingVariantId, quantity: 1, unitCost: startingCost(row.buyPriceUsd) })
    form.clearErrors("lines")
  }

  const subtotalCents = (lines ?? []).reduce((sum, line) => sum + toCents(line.unitCost) * (Number(line.quantity) || 0), 0)
  const totalCents = subtotalCents + toCents(shippingCost)
  const money = (cents: number) => formatCost(cents / 100, currency)
  const usdEquivalent = currency === Currency.GHS ? (order?.exchangeRate ?? rate) : null

  const onSubmit: SubmitHandler<FormOutput> = (values) => {
    startTransition(async () => {
      const payload = { ...values, expectedOn: values.expectedOn ? toDay(values.expectedOn) : null, storeId }
      if (order) {
        const response = await updatePurchaseOrderAction({ ...payload, id: order.id, version: order.version })
        if (!response.success) {
          toast.add({ title: "Unable to save the purchase order", description: response.error, type: "error" })
          return
        }
        setIsSaved(true)
        toast.add({ title: "Purchase order updated", description: "Your changes have been saved.", type: "success" })
        router.push(backTo)
        return
      }

      const response = await createPurchaseOrderAction(payload)
      if (!response.success) {
        toast.add({ title: "Unable to create the purchase order", description: response.error, type: "error" })
        return
      }
      setIsSaved(true)
      toast.add({ title: "Purchase order saved", description: `${response.data.reference} is a draft. Mark it as ordered once it's sent to the supplier.`, type: "success" })
      router.push(`/store/purchase-orders/${response.data.id}/details`)
    })
  }

  const isBusy = isPending || isSaved
  const linesError = form.formState.errors.lines?.message ?? form.formState.errors.lines?.root?.message
  const costPrefix = currency === Currency.GHS ? "GH₵" : "$"

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader
          heading={order ? `Edit ${order.reference}` : "Create Purchase Order"}
          description={
            order
              ? isDraft
                ? "Still a draft."
                : "Ordered: the supplier and currency are fixed."
              : suggested.length
                ? "Low listings get enough to reach twice their low-stock level. Saved as a draft."
                : "Saved as a draft."
          }
          backTo={backTo}
          isPending={isBusy}
          isDirty={form.formState.isDirty}
          handleDiscard={() => router.push(backTo)}
        />

        <div className="grid gap-8">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {/* Left column */}
            <div className="grid auto-rows-max gap-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Items</CardTitle>
                  <CardDescription>{fields.length ? `How many of each, at the supplier's price in ${currency}.` : "Add items from the store's listings below."}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {fields.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="w-28">Qty</TableHead>
                          <TableHead className="w-36">Unit cost</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((field, index) => {
                          const info = lineInfo[lineKey(field.listingId, field.listingVariantId)]
                          const line = lines?.[index]
                          const received = info?.received ?? 0
                          const details = [
                            info?.sku,
                            info?.stock === null ? "Stock not tracked" : info && `${info.stock} in stock`,
                            info?.incoming ? `${info.incoming} incoming` : null,
                            received ? `${received} received` : null,
                          ].filter(Boolean)
                          return (
                            <TableRow key={field.id}>
                              <TableCell className="align-top whitespace-normal">
                                <div className="grid">
                                  <span>{info?.label ?? "Item"}</span>
                                  <span className="text-xs text-muted-foreground">{details.join(" · ")}</span>
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <NumberInputField
                                  control={form.control}
                                  name={`lines.${index}.quantity`}
                                  step={1}
                                  min={Math.max(received, 1)}
                                  max={99_999}
                                  disabled={isBusy}
                                  aria-label={`Quantity of ${info?.label ?? "item"}`}
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <NumberInputField
                                  control={form.control}
                                  name={`lines.${index}.unitCost`}
                                  step={0.01}
                                  min={0}
                                  prependText={costPrefix}
                                  disabled={isBusy}
                                  aria-label={`Unit cost of ${info?.label ?? "item"}`}
                                />
                              </TableCell>
                              <TableCell className="pt-4 text-right align-top tabular-nums">{money(toCents(line?.unitCost) * (Number(line?.quantity) || 0))}</TableCell>
                              <TableCell className="align-top">
                                {/* A line that has started to arrive stays: lower its quantity to what came in instead */}
                                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${info?.label ?? "item"}`} onClick={() => remove(index)} disabled={isBusy || received > 0}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                  {linesError && <p className="text-sm text-destructive">{linesError}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Add items</CardTitle>
                  <CardDescription>New lines start at their last buy price.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU" aria-label="Search listings" className="pl-9" />
                  </div>

                  {searchError && <p className="text-sm text-destructive">{searchError}</p>}
                  {results === null ? (
                    <div className="flex justify-center py-6">
                      <Spinner />
                    </div>
                  ) : results.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{search ? "No listings match your search." : "This store has no listings yet."}</p>
                  ) : (
                    <ScrollArea className="-mr-3 flex max-h-[60vh] flex-col">
                      <ul className="grid gap-3 pr-3 md:grid-cols-2">
                        {results.map((listing) => (
                          <li key={listing.listingId} className="grid content-start gap-2 rounded-lg border p-3">
                            <div className="flex items-center gap-3">
                              <div className="size-10 shrink-0 overflow-hidden rounded bg-muted">{listing.image && <img alt="" src={listing.image} className="size-full object-cover" />}</div>
                              <div className="grid">
                                <span className="font-medium">{listing.productName}</span>
                                <span className="text-xs text-muted-foreground">{listing.brandName}</span>
                              </div>
                            </div>
                            {listing.rows.map((row) => {
                              const isAdded = added.has(lineKey(listing.listingId, row.listingVariantId))
                              return (
                                <div key={row.listingVariantId ?? "listing"} className="flex items-center justify-between gap-2 text-sm">
                                  <div className="grid">
                                    {row.variantDescription && <span>{row.variantDescription}</span>}
                                    <span className="text-xs text-muted-foreground">
                                      {[
                                        row.stock === null ? "Stock not tracked" : `${row.stock} in stock`,
                                        row.incoming ? `${row.incoming} incoming` : null,
                                        row.buyPriceUsd ? `last cost ${formatCurrency(row.buyPriceUsd, "USD", "en-US")}` : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </span>
                                  </div>
                                  <Button type="button" size="sm" variant="outline" onClick={() => addRow(listing, row)} disabled={isAdded || isBusy}>
                                    {isAdded ? "Added" : "Add"}
                                  </Button>
                                </div>
                              )
                            })}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="grid auto-rows-max gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Supplier</CardTitle>
                  <CardDescription>{isDraft ? "Who the stock is ordered from." : "It has been ordered from this supplier."}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {suppliers.length ? (
                    <SelectField
                      control={form.control}
                      name="supplierId"
                      placeholder="Choose a supplier"
                      options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
                      disabled={isBusy || !isDraft}
                      aria-label="Supplier"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">This store has no suppliers yet.</p>
                  )}
                  {isDraft && (
                    <Link href="/store/suppliers/add" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
                      Add a supplier
                    </Link>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                  <CardDescription>Costs are kept as the supplier invoices them.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <SelectField
                      control={form.control}
                      label="Currency"
                      name="currency"
                      options={currencyOptions}
                      disabled={isBusy || !isDraft}
                      description={
                        currency === Currency.GHS
                          ? isDraft
                            ? `Converted to USD for buy prices at the day's rate when it's marked as ordered${rate ? ` (today ${rate})` : "; there's no current rate"}.`
                            : `Converted to USD at ${order?.exchangeRate}, the rate when it was ordered.`
                          : undefined
                      }
                    />
                    <DateField control={form.control} name="expectedOn" label="Expected on" placeholder="When the supplier says" disabled={isBusy} />
                    <NumberInputField control={form.control} label="Shipping" name="shippingCost" step={0.01} min={0} prependText={costPrefix} disabled={isBusy} />
                    <TextareaField control={form.control} label="Notes" name="notes" placeholder="Their invoice number, payment terms…" disabled={isBusy} />
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items</span>
                    <span className="tabular-nums">{money(subtotalCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="tabular-nums">{money(toCents(shippingCost))}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span className="tabular-nums">{money(totalCents)}</span>
                  </div>
                  {usdEquivalent && (
                    <p className="text-right text-xs text-muted-foreground">{`About ${formatCurrency(String(totalCents / 100 / Number(usdEquivalent)), "USD", "en-US")} at ${usdEquivalent}`}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <SharedFormFooter backTo={backTo} isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={() => router.push(backTo)} />
        </div>
      </div>
    </form>
  )
}
