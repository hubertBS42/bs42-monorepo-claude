"use client"
/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */

import { useEffect, useState } from "react"
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form"
import { Package, Search, SearchX, Trash2 } from "lucide-react"
import { NumberInputField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Spinner } from "@workspace/ui/components/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { formatCurrency } from "@workspace/utils/currency"
import { searchOrderableListingsAction } from "@/lib/actions/store-order.actions"
import type { OrderableListing } from "@/types"
import { itemKey, type ChosenItem, type OrderFormInput, type OrderFormOutput } from "../create-order-form"
import { EmptyState } from "@workspace/ui/components/empty-state"

interface ItemsStepProps {
  storeId: string
  form: UseFormReturn<OrderFormInput, unknown, OrderFormOutput>
  chosen: Record<string, ChosenItem>
  onChosenChange: (chosen: Record<string, ChosenItem>) => void
}

const ghs = (amount: string) => formatCurrency(amount, "GHS", "en-GH")

export default function ItemsStep({ storeId, form, chosen, onChosenChange }: ItemsStepProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const items = useWatch({ control: form.control, name: "items" })
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<OrderableListing[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  // A search typed but not answered yet: the results shown are for the previous one
  const [isSearching, setIsSearching] = useState(false)

  // Searches as the user types, a moment after they stop; the latest search wins
  useEffect(() => {
    let isCurrent = true
    const timer = setTimeout(() => {
      searchOrderableListingsAction({ storeId, search })
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
          setSearchError("Unable to search the store's listings.")
        })
    }, 300)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [storeId, search])

  const added = new Set((items ?? []).map((item) => itemKey(item.listingId, item.listingVariantId)))

  const addRow = (listing: OrderableListing, row: OrderableListing["rows"][number]) => {
    const key = itemKey(listing.listingId, row.listingVariantId)
    onChosenChange({
      ...chosen,
      [key]: { label: row.variantDescription ? `${listing.productName} (${row.variantDescription})` : listing.productName, sku: row.sku, priceGhs: row.priceGhs, stock: row.stock },
    })
    append({ listingId: listing.listingId, listingVariantId: row.listingVariantId, quantity: 1 })
    form.clearErrors("items")
  }

  const itemsError = form.formState.errors.items?.message ?? form.formState.errors.items?.root?.message

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>The store&apos;s listings</CardTitle>
          <CardDescription>Listings on sale, in GHS at today&apos;s rate.</CardDescription>
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
              aria-label="Search listings"
              className="pr-9 pl-9"
            />
            {isSearching && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" aria-label="Searching" />}
          </div>

          {searchError && <p className="text-sm text-destructive">{searchError}</p>}
          {results === null ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : results.length === 0 ? (
            <EmptyState icon={SearchX} title={search ? "No matches" : "Nothing on sale"} description={search ? "No listing matches your search." : "This store has no listings on sale."} />
          ) : (
            <ScrollArea className="-mr-3 flex max-h-[60vh] flex-col">
              <ul className={cn("grid gap-3 pr-3 transition-opacity", isSearching && "opacity-60")} aria-busy={isSearching}>
                {results.map((listing) => (
                  <li key={listing.listingId} className="grid gap-2 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 shrink-0 overflow-hidden rounded bg-muted">{listing.image && <img alt="" src={listing.image} className="size-full object-cover" />}</div>
                      <div className="grid">
                        <span className="font-medium">{listing.productName}</span>
                        <span className="text-xs text-muted-foreground">{listing.brandName}</span>
                      </div>
                    </div>
                    {listing.rows.map((row) => {
                      const isAdded = added.has(itemKey(listing.listingId, row.listingVariantId))
                      const soldOut = row.stock === 0
                      return (
                        <div key={row.listingVariantId ?? "listing"} className="flex items-center justify-between gap-2 text-sm">
                          <div className="grid">
                            {row.variantDescription && <span>{row.variantDescription}</span>}
                            <span className="text-xs text-muted-foreground">
                              {[row.priceGhs ? ghs(row.priceGhs) : `$${row.priceUsd}`, row.stock === null ? "Stock not tracked" : `${row.stock} in stock`, row.sku].filter(Boolean).join(" · ")}
                            </span>
                          </div>
                          <Button type="button" size="sm" variant="outline" onClick={() => addRow(listing, row)} disabled={isAdded || soldOut}>
                            {isAdded ? "Added" : soldOut ? "Sold out" : "Add"}
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
          <CardTitle>In this order</CardTitle>
          <CardDescription>Set how many of each.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {fields.length === 0 && <EmptyState icon={Package} title="No items yet" description="Add items from the store's listings." />}
          {fields.length > 0 && (
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
                      <TableCell>
                        <div className="grid">
                          <span>{info?.label ?? "Item"}</span>
                          <span className="text-xs text-muted-foreground">{[info?.priceGhs && `${ghs(info.priceGhs)} each`, info?.sku].filter(Boolean).join(" · ")}</span>
                          {overStock && <span className="text-xs text-destructive">{`Only ${info?.stock} in stock`}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <NumberInputField control={form.control} name={`items.${index}.quantity`} min={1} max={999} aria-label={`Quantity of ${info?.label ?? "item"}`} />
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
          )}
          {itemsError && <p className="text-sm text-destructive">{itemsError}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
