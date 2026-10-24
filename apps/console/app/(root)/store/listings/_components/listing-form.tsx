"use client"
/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { SubmitHandler, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { Status } from "@workspace/db/enums"
import { NumberInputField, SelectField, SwitchField, TextareaField } from "@workspace/forms"
import Link from "next/link"
import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"
import SharedFormFooter from "@/components/shared-form-footer"
import SharedFormHeader from "@/components/shared-form-header"
import { StorefrontLinkCard } from "@/components/storefront-link-card"
import type { StorefrontLink } from "@/lib/data/storefront-links.data"
import { STATUS_OPTIONS } from "@/constants"
import { createListingAction, updateListingAction } from "@/lib/actions/listing.actions"
import { listingFormSchema } from "@/lib/schemas/listing.schemas"
import { MANUAL_STOCK_REASONS, STOCK_MOVEMENT_REASON_LABELS } from "@/lib/stock-reasons"
import type { ListingFormData, ListingSnapshot, StockChangedResponse } from "@/types"
import DeleteListing from "./delete-listing"

type FormInput = z.input<typeof listingFormSchema>
type FormOutput = z.output<typeof listingFormSchema>

interface ListingFormProps {
  storeId: string
  data: ListingFormData
  // Its product's storefront page, when editing
  storefrontLink?: StorefrontLink
}

// ActionResponse's code is a plain string, so it can't tell this reply apart by itself
function isStockChanged(response: { success: boolean; code?: string }): response is StockChangedResponse {
  return !response.success && response.code === "STOCK_CHANGED" && "currentStock" in response
}

const stockReasonOptions = MANUAL_STOCK_REASONS.map((reason) => ({ value: reason, label: STOCK_MOVEMENT_REASON_LABELS[reason] }))

// One form for adding and editing, as for products
const ListingForm = ({ storeId, data, storefrontLink }: ListingFormProps) => {
  const { id, product, variants: variantRows } = data
  const isEditing = !!id
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: { ...data.values, stockReason: null, stockNote: "" },
  })

  const trackInventory = useWatch({ control: form.control, name: "trackInventory" })
  const stock = useWatch({ control: form.control, name: "stock" })
  const variantValues = useWatch({ control: form.control, name: "variants" })
  const stockReason = useWatch({ control: form.control, name: "stockReason" })
  const sellPrice = useWatch({ control: form.control, name: "sellPrice" })

  // What the form loaded, sent with an edit so the action can tell the user's changes from changes made elsewhere.
  // A stock conflict replaces its stock, so the next save starts from the current stock.
  const [original, setOriginal] = useState<ListingSnapshot>(data.values)

  // Stock changed by hand on an existing listing (or a variant already on it) needs a reason for the stock history. A
  // variant new to the listing starts with its initial stock, which needs none.
  const hasStockEdits = isEditing && (stock !== original.stock || variantRows.some((row, index) => row.inListing && variantValues?.[index]?.stock !== original.variants[index]?.stock))

  // From a STOCK_CHANGED reply: stock the user left alone just updates; stock they changed is marked for them to check
  const applyCurrentStock = ({ listing, variants: current }: StockChangedResponse["currentStock"]) => {
    const values = form.getValues()
    const message = (was: number, now: number) => `Now ${now}, was ${was} when you opened this. Check it and save again.`

    if (listing !== original.stock) {
      if (values.stock === original.stock) form.setValue("stock", listing)
      else form.setError("stock", { type: "custom", message: message(original.stock, listing) })
    }
    original.variants.forEach((variant, index) => {
      const now = current[variant.variantId]
      if (now === undefined || now === variant.stock) return
      if (values.variants[index]?.stock === variant.stock) form.setValue(`variants.${index}.stock`, now)
      else form.setError(`variants.${index}.stock`, { type: "custom", message: message(variant.stock, now) })
    })

    setOriginal({ ...original, stock: listing, variants: original.variants.map((variant) => ({ ...variant, stock: current[variant.variantId] ?? variant.stock })) })
  }

  const onSubmit: SubmitHandler<FormOutput> = (values) => {
    if (hasStockEdits && !values.stockReason) {
      form.setError("stockReason", { type: "custom", message: "Choose why the stock changed" })
      return
    }

    startTransition(async () => {
      const response = id ? await updateListingAction({ ...values, id, storeId, original }) : await createListingAction({ ...values, productId: product.id, storeId })

      if (isStockChanged(response)) {
        applyCurrentStock(response.currentStock)
        toast.add({ title: "Stock changed", description: response.error, type: "error" })
        return
      }

      if (!response.success && response.code === "STOCK_REASON_REQUIRED") {
        form.setError("stockReason", { type: "custom", message: response.error })
        return
      }

      if (response.success) {
        toast.add(
          isEditing
            ? { title: "Listing updated", description: "Your changes have been saved.", type: "success" }
            : { title: "Listing added", description: `${product.name} is now listed in this store.`, type: "success" }
        )
        router.push("/store/listings")
        return
      }

      toast.add({ title: isEditing ? "Unable to save the listing" : "Unable to add the listing", description: response.error, type: "error" })
    })
  }

  const handleDiscard = () => router.push("/store/listings")

  const productStatusNote = product.status === Status.PUBLISHED ? null : `This product is ${product.status.toLowerCase()} in the catalogue, so customers can't see it whatever this listing's status.`

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader
          heading={isEditing ? "Edit Listing" : "Add Listing"}
          description={isEditing ? "Update this store's prices and stock for the product." : "Set this store's prices and stock for the product."}
          backTo="/store/listings"
          isPending={isPending}
          isDirty={form.formState.isDirty}
          handleDiscard={handleDiscard}
        />

        <div className="grid gap-8">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {/* Left column */}
            <div className="grid auto-rows-max gap-y-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Product</CardTitle>
                  <CardDescription>The catalogue product this listing sells.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="flex items-center gap-4">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">{product.image && <img alt="" src={product.image} className="size-full object-cover" />}</div>
                    <div className="grid gap-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.brandName}</p>
                      <p className="text-xs text-muted-foreground">{product.categoryPath}</p>
                      <Link href={`/store/products/${product.id}`} className="w-fit text-xs underline-offset-4 hover:underline">
                        Product details
                      </Link>
                    </div>
                  </div>
                  {productStatusNote && <p className="text-sm text-destructive">{productStatusNote}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                  <CardDescription>In USD. Customers pay in GHS at the day&apos;s rate.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <NumberInputField control={form.control} label="Sell price" name="sellPrice" step={0.01} min={0} prependText="$" disabled={isPending} />
                    <NumberInputField control={form.control} label="Compare-at price" name="compareAtPrice" step={0.01} min={0} prependText="$" placeholder="None" disabled={isPending} />
                    <NumberInputField control={form.control} label="Buy price" name="buyPrice" step={0.01} min={0} prependText="$" placeholder="None" disabled={isPending} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Inventory</CardTitle>
                  <CardDescription>{product.hasVariants ? "Stock is set per variant below." : "This store's stock of the product."}</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <SwitchField
                      control={form.control}
                      variant="card"
                      label="Track inventory"
                      name="trackInventory"
                      disabled={isPending}
                      description={product.hasVariants ? "Count stock and warn when it runs low, for every variant" : "Count stock and warn when it runs low"}
                    />
                    <div className="grid gap-5 sm:grid-cols-2">
                      {!product.hasVariants && <NumberInputField control={form.control} label="Stock" name="stock" disabled={isPending || !trackInventory} />}
                      <NumberInputField
                        control={form.control}
                        label="Low stock alert"
                        name="lowStockThreshold"
                        description={product.hasVariants ? "Applies to each variant" : undefined}
                        disabled={isPending || !trackInventory}
                      />
                    </div>
                  </FieldGroup>
                </CardContent>
              </Card>

              {product.hasVariants && (
                <Card>
                  <CardHeader>
                    <CardTitle>Variants</CardTitle>
                    <CardDescription>An empty price uses the listing&apos;s.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {variantRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">This product has no variants on sale in the catalogue.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Variant</TableHead>
                            <TableHead>Sell price</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {variantRows.map((variant, index) => {
                            const label = Object.values(variant.attributes).join(" / ")
                            return (
                              <TableRow key={variant.variantId}>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(variant.attributes).map(([option, value]) => (
                                      <Badge key={option} variant="secondary">
                                        {option}: {value}
                                      </Badge>
                                    ))}
                                  </div>
                                  <p className="mt-1 font-mono text-xs text-muted-foreground">{variant.sku}</p>
                                  {isEditing && !variant.inListing && <p className="mt-1 text-xs text-muted-foreground">New in the catalogue: saving adds it to this listing.</p>}
                                </TableCell>
                                <TableCell className="w-36 align-top">
                                  <NumberInputField
                                    control={form.control}
                                    name={`variants.${index}.sellPrice`}
                                    aria-label={`Sell price of ${label}`}
                                    step={0.01}
                                    min={0}
                                    prependText="$"
                                    // The listing's price, which an empty field sells at
                                    placeholder={typeof sellPrice === "number" ? sellPrice.toFixed(2) : undefined}
                                    disabled={isPending}
                                  />
                                </TableCell>
                                <TableCell className="w-28 align-top">
                                  <NumberInputField control={form.control} name={`variants.${index}.stock`} aria-label={`Stock of ${label}`} disabled={isPending || !trackInventory} />
                                </TableCell>
                                <TableCell className="w-36 align-top">
                                  <SelectField control={form.control} name={`variants.${index}.status`} aria-label={`Status of ${label}`} options={STATUS_OPTIONS} disabled={isPending} />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}

              {hasStockEdits && (
                <Card>
                  <CardHeader>
                    <CardTitle>Stock change</CardTitle>
                    <CardDescription>Recorded in the stock history.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <SelectField control={form.control} label="Reason" name="stockReason" placeholder="Choose a reason" options={stockReasonOptions} disabled={isPending} />
                      <TextareaField control={form.control} label="Note" name="stockNote" placeholder={stockReason === "OTHER" ? "What happened" : "Optional"} disabled={isPending} />
                    </FieldGroup>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column */}
            <div className="grid auto-rows-max gap-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                  <CardDescription>Only published listings are on sale.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <SelectField control={form.control} name="status" aria-label="Status" options={STATUS_OPTIONS} disabled={isPending} />
                  <SwitchField control={form.control} variant="card" label="Featured" name="isFeatured" disabled={isPending} description="Show this listing in the store's featured sections" />
                </CardContent>
              </Card>

              {storefrontLink && <StorefrontLinkCard link={storefrontLink} description="Shows the best offer across stores, which may not be this one." />}

              {id && (
                <Card>
                  <CardHeader>
                    <CardTitle>Stock history</CardTitle>
                    <CardDescription>Every change to this listing&apos;s stock.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link href={`/store/listings/${id}/stock-history`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                      View stock history
                    </Link>
                  </CardContent>
                </Card>
              )}

              {id && (
                <Card>
                  <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>Listings that have been ordered can only be archived.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DeleteListing listing={{ id, name: product.name }} storeId={storeId} hasOrders={data.hasOrders} />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <SharedFormFooter backTo="/store/listings" isPending={isPending} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>
    </form>
  )
}

export default ListingForm
