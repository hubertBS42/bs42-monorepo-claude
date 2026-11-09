"use client"
/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */

import { useEffect, useRef, useState } from "react"
import { useFieldArray, useWatch } from "react-hook-form"
import { Package, Search, SearchX, Trash2 } from "lucide-react"
import { NumberInputField, SwitchField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { InfoTip } from "@workspace/ui/components/info-tip"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { formatCurrency } from "@workspace/utils/currency"
import { searchQuotableItemsAction } from "@/lib/actions/quote.actions"
import type { QuotableProduct } from "@/lib/staff-quotes"
import type { ChosenQuoteItem } from "@/types"
import { asStaffSaleForm, itemKey, type StaffSaleFields, type StaffSaleForm, type StaffSaleKind } from "./form"
import { EmptyState } from "@workspace/ui/components/empty-state"

interface ItemsStepProps<T extends StaffSaleFields, O> {
  // A store's own wizard, listing only its items; null or left out on the platform's
  storeId?: string | null
  kind: StaffSaleKind
  form: StaffSaleForm<T, O>
  chosen: Record<string, ChosenQuoteItem>
  onChosenChange: (chosen: Record<string, ChosenQuoteItem>) => void
}

const ghs = (amount: string) => formatCurrency(amount, "GHS", "en-GH")

// "3 in stock", "Out of stock · 10 on order"
function stockLine(row: QuotableProduct["rows"][number]) {
  const onOrder = row.incoming > 0 ? ` · ${row.incoming} on order` : ""
  if (row.stock === null) return "Stock not tracked"
  return row.stock > 0 ? `${row.stock} in stock${onOrder}` : `Out of stock${onOrder}`
}

// What customers can buy, from any store, each at the offer the storefront would sell, with installation where it's offered
export default function ItemsStep<T extends StaffSaleFields, O>({ storeId = null, kind, form: wizardForm, chosen, onChosenChange }: ItemsStepProps<T, O>) {
  const form = asStaffSaleForm(wizardForm)
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const items = useWatch({ control: form.control, name: "items" })
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<QuotableProduct[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  // A search typed but not answered yet: the results shown are for the previous one
  const [isSearching, setIsSearching] = useState(false)

  // Searches as the user types, a moment after they stop; the latest search wins
  useEffect(() => {
    let isCurrent = true
    const timer = setTimeout(() => {
      searchQuotableItemsAction({ search, storeId })
        .then((response) => {
          if (!isCurrent) return
          if (response.success) {
            setResults(response.data)
            setIsSearching(false)
            setSearchError(null)
          } else {
            setSearchError(response.error)
            setIsSearching(false)
          }
        })
        .catch(() => {
          if (!isCurrent) return
          setIsSearching(false)
          setSearchError("Unable to search the products on sale.")
        })
    }, 300)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [search])

  const added = new Set((items ?? []).map((item) => itemKey(item.listingId, item.listingVariantId)))

  const addRow = (product: QuotableProduct, row: QuotableProduct["rows"][number]) => {
    const key = itemKey(row.listingId, row.listingVariantId)
    onChosenChange({
      ...chosen,
      [key]: {
        label: row.variantDescription ? `${product.productName} (${row.variantDescription})` : product.productName,
        sku: row.sku,
        priceGhs: row.priceGhs,
        stock: row.stock,
        installationFeeGhs: product.installationFeeGhs,
        storeId: row.storeId,
        storeName: row.storeName,
      },
    })
    append({ listingId: row.listingId, listingVariantId: row.listingVariantId, quantity: 1, installation: false })
    form.clearErrors("items")
  }

  const itemsError = form.formState.errors.items?.message ?? form.formState.errors.items?.root?.message

  // A newly added line scrolls into view within the order's list (not the page: on a phone the cards are stacked)
  const orderListRef = useRef<HTMLDivElement>(null)
  const lineCount = fields.length
  const lastCount = useRef(lineCount)
  useEffect(() => {
    if (lineCount > lastCount.current) {
      const viewport = orderListRef.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]")
      viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
    }
    lastCount.current = lineCount
  }, [lineCount])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Products on sale
            {!storeId && <InfoTip about="Products on sale">Each item comes from the store the storefront would sell it from: in stock first, then on order, then the cheapest.</InfoTip>}
          </CardTitle>
          <CardDescription>Priced as on the storefront today, before tax.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setIsSearching(true)
              }}
              placeholder="Search by name or SKU"
              aria-label="Search products"
              className="pr-3 pl-9 [&::-webkit-search-cancel-button]:ml-6"
            />
            {isSearching && <Spinner className="absolute top-1/2 right-8 -translate-y-1/2 text-muted-foreground" aria-label="Searching" />}
          </div>

          {searchError && <p className="text-sm text-destructive">{searchError}</p>}
          {results === null ? (
            !searchError && (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )
          ) : results.length === 0 ? (
            <EmptyState icon={SearchX} title={search ? "No matches" : "Nothing on sale"} description={search ? "No product on sale matches your search." : undefined} />
          ) : (
            <ScrollArea className="-mr-3 flex max-h-72 flex-col">
              <ul className={cn("grid gap-3 pr-3 transition-opacity", isSearching && "opacity-60")} aria-busy={isSearching}>
                {results.map((product) => (
                  <li key={product.productId} className="grid gap-2 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 shrink-0 overflow-hidden rounded bg-muted">{product.image && <img alt="" src={product.image} className="size-full object-cover" />}</div>
                      <div className="grid">
                        <span className="font-medium">{product.productName}</span>
                        <span className="text-xs text-muted-foreground">
                          {[product.brandName, product.installationFeeGhs && `Installation ${ghs(product.installationFeeGhs)} each`].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    </div>
                    {product.rows.map((row) => {
                      const isAdded = added.has(itemKey(row.listingId, row.listingVariantId))
                      return (
                        <div key={row.listingVariantId ?? row.listingId} className="flex items-center justify-between gap-2 text-sm">
                          <div className="grid">
                            {row.variantDescription && <span>{row.variantDescription}</span>}
                            <span className="text-xs text-muted-foreground">{[ghs(row.priceGhs), stockLine(row), !storeId && row.storeName, row.sku].filter(Boolean).join(" · ")}</span>
                          </div>
                          <Button type="button" size="sm" variant="outline" onClick={() => addRow(product, row)} disabled={isAdded}>
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

      <Card>
        <CardHeader>
          <CardTitle>{kind === "quote" ? "In this quotation" : "In this order"}</CardTitle>
          <CardDescription>{storeId ? "Set how many of each." : "Set how many of each, and whether we install them."}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2">
          {fields.length === 0 && (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState icon={Package} title="No items yet" description="Add items from the products on sale." />
            </div>
          )}
          {fields.length > 0 && (
            // Scrolls like the list beside it, so the two cards stay the same height (on wide screens it fills the card, which the
            // list beside it sizes); the header stays in view
            <ScrollArea
              ref={orderListRef}
              className="-mr-3 flex max-h-72 flex-col lg:max-h-none lg:min-h-0 lg:flex-1 lg:basis-0 [&_[data-slot=table-container]]:overflow-visible [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card"
            >
              <div className="pr-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-28">Qty</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const info = chosen[itemKey(field.listingId, field.listingVariantId)]
                      const quantity = items?.[index]?.quantity
                      const overStock = info?.stock != null && typeof quantity === "number" && quantity > info.stock
                      return (
                        <TableRow key={field.id}>
                          <TableCell className="whitespace-normal">
                            <div className="grid gap-1">
                              <span>{info?.label ?? "Item"}</span>
                              <span className="text-xs text-muted-foreground">{[info?.priceGhs && `${ghs(info.priceGhs)} each`, info?.sku].filter(Boolean).join(" · ")}</span>
                              {/* Only a warning: stock is checked again when the order is made (for a quote, when it's accepted) */}
                              {overStock && <span className="text-xs text-amber-600 dark:text-amber-500">{`Only ${info?.stock} in stock now`}</span>}
                              {info?.installationFeeGhs && (
                                <SwitchField control={form.control} name={`items.${index}.installation`} size="sm" label={`Install, ${ghs(info.installationFeeGhs)} each`} className="mt-1" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            {/* A width of its own, or a long item name squeezes it to nothing on a phone */}
                            <div className="w-20 sm:w-24">
                              <NumberInputField control={form.control} name={`items.${index}.quantity`} min={1} max={999} aria-label={`Quantity of ${info?.label ?? "item"}`} />
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${info?.label ?? "item"}`} onClick={() => remove(index)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
          {itemsError && <p className="text-sm text-destructive">{itemsError}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
