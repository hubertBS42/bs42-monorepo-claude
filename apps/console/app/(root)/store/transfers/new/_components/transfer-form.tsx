"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch, type SubmitHandler } from "react-hook-form"
import type { z } from "zod"
import { Plus, Trash2 } from "lucide-react"
import { NumberInputField, SelectField, TextareaField } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldError, FieldGroup } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"
import SharedFormFooter from "@/components/shared-form-footer"
import SharedFormHeader from "@/components/shared-form-header"
import { createStockTransferAction, searchTransferableAction } from "@/lib/actions/stock-transfer.actions"
import { STOCK_TRANSFER_LIMITS, stockTransferFormSchema } from "@/lib/schemas/stock-transfer.schemas"
import type { SelectItem, TransferableRow } from "@/types"

type FormInput = z.input<typeof stockTransferFormSchema>
type FormOutput = z.output<typeof stockTransferFormSchema>

const BACK_TO = "/store/transfers"

// How long typing pauses before the store's rows are searched
const SEARCH_DELAY_MS = 300

const rowKey = (row: { listingId: string; listingVariantId: string | null }) => `${row.listingId}:${row.listingVariantId ?? ""}`
const rowLabel = (row: TransferableRow) => (row.variantDescription ? `${row.productName} (${row.variantDescription})` : row.productName)

// This store's rows to send, matching the search, with whether the chosen store lists each
function useTransferableRows(fromStoreId: string, toStoreId: string, search: string) {
  const [rows, setRows] = useState<TransferableRow[]>([])
  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      searchTransferableAction({ fromStoreId, toStoreId: toStoreId || null, search })
        .then((response) => {
          if (current && response.success) setRows(response.data)
        })
        .catch((error) => console.error("Could not search the store's listings:", error))
    }, SEARCH_DELAY_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [fromStoreId, toStoreId, search])
  return rows
}

export default function TransferForm({ storeId, destinations }: { storeId: string; destinations: SelectItem[] }) {
  const router = useRouter()
  // Keeps the form locked from a successful send until the page changes
  const [isSaved, setIsSaved] = useState(false)
  const [search, setSearch] = useState("")
  // What each added line is, for its label and the stock it can't go over
  const [rowInfo, setRowInfo] = useState<Map<string, TransferableRow>>(new Map())

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(stockTransferFormSchema),
    defaultValues: { toStoreId: destinations.length === 1 ? destinations[0]!.id : "", notes: "", lines: [] },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" })
  const toStoreId = useWatch({ control: form.control, name: "toStoreId" })
  const results = useTransferableRows(storeId, toStoreId, search)
  const added = new Set(fields.map(rowKey))

  // The latest search result for a line wins over what it was added with: its stock, and the chosen store's listing
  const latest = new Map(results.map((row) => [rowKey(row), row]))

  const add = (row: TransferableRow) => {
    setRowInfo((current) => new Map(current).set(rowKey(row), row))
    append({ listingId: row.listingId, listingVariantId: row.listingVariantId, quantity: 1 })
  }

  const onSubmit: SubmitHandler<FormOutput> = async (values) => {
    const response = await createStockTransferAction({ ...values, fromStoreId: storeId })
    if (!response.success) {
      toast.add({ title: "Unable to send the stock", description: response.error, type: "error" })
      return
    }
    setIsSaved(true)
    router.push(`/store/transfers/${response.data.id}`)
    toast.add({ title: `${response.data.reference} sent`, description: "The stock has left this store's listings. The other store receives it when it arrives.", type: "success" })
  }

  const isBusy = form.formState.isSubmitting || isSaved
  const linesError = form.formState.errors.lines?.message ?? form.formState.errors.lines?.root?.message

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader
          heading="Send Stock"
          description="Move stock from this store to another you manage. It leaves this store's listings now, and the other store adds what arrives."
          backTo={BACK_TO}
          isPending={isBusy}
          isDirty={form.formState.isDirty}
          handleDiscard={() => router.push(BACK_TO)}
        />

        <div className="grid gap-8">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <div className="grid auto-rows-max gap-y-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Items</CardTitle>
                  <CardDescription>This store&apos;s listings that track stock and have some. The other store must list each product (and variant) too.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by product name or SKU" disabled={isBusy} aria-label="Search this store's listings" />
                  {results.length > 0 && (
                    <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-md border p-1">
                      {results.map((row) => {
                        const isAdded = added.has(rowKey(row))
                        return (
                          <li key={rowKey(row)} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-accent/50">
                            <div className="grid min-w-0 flex-1">
                              <span className="truncate text-sm">{rowLabel(row)}</span>
                              <span className="text-xs text-muted-foreground">
                                {[`${row.stock} in stock`, row.sku, row.listedThere === false ? "Not listed in the other store" : null].filter(Boolean).join(" · ")}
                              </span>
                            </div>
                            <Button type="button" variant="outline" size="xs" disabled={isBusy || isAdded || row.listedThere === false} onClick={() => add(row)}>
                              <Plus />
                              {isAdded ? "Added" : "Add"}
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {fields.length > 0 && (
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted">
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="w-32">Quantity</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fields.map((field, index) => {
                            const info = latest.get(rowKey(field)) ?? rowInfo.get(rowKey(field))
                            return (
                              <TableRow key={field.id}>
                                <TableCell>
                                  <div className="grid gap-0.5">
                                    <span>{info ? rowLabel(info) : "Item"}</span>
                                    {info && (
                                      <span className="text-xs text-muted-foreground">
                                        {[`${info.stock} in stock`, info.listedThere === false ? "Not listed in the other store" : null].filter(Boolean).join(" · ")}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <NumberInputField control={form.control} name={`lines.${index}.quantity`} aria-label="Quantity" step={1} min={1} max={info?.stock} disabled={isBusy} />
                                </TableCell>
                                <TableCell>
                                  <Button type="button" variant="ghost" size="icon-xs" disabled={isBusy} onClick={() => remove(index)}>
                                    <Trash2 />
                                    <span className="sr-only">{`Remove ${info ? rowLabel(info) : "item"}`}</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {linesError && <FieldError errors={[{ message: linesError }]} />}
                </CardContent>
              </Card>
            </div>

            <div className="grid auto-rows-max gap-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Send to</CardTitle>
                  <CardDescription>The stores you&apos;re an owner or admin of.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <SelectField
                      control={form.control}
                      label="Store"
                      name="toStoreId"
                      options={destinations.map((store) => ({ value: store.id, label: store.name }))}
                      placeholder="Choose a store"
                      disabled={isBusy}
                    />
                    <TextareaField
                      control={form.control}
                      label="Notes"
                      name="notes"
                      placeholder="e.g. Sent with the driver on Tuesday"
                      showCount
                      maxLength={STOCK_TRANSFER_LIMITS.notes}
                      disabled={isBusy}
                    />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>
          </div>

          <SharedFormFooter backTo={BACK_TO} isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={() => router.push(BACK_TO)} />
        </div>
      </div>
    </form>
  )
}
