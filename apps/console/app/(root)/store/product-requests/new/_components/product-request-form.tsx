"use client"

/* eslint-disable @next/next/no-img-element -- next/image would need the storage host in images.remotePatterns */
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch, type SubmitHandler } from "react-hook-form"
import type { z } from "zod"
import { CascaderField, SelectField, TextareaField, TextInputField, type CascaderOption } from "@workspace/forms"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { toast } from "@workspace/ui/components/toast"
import SharedFormFooter from "@/components/shared-form-footer"
import SharedFormHeader from "@/components/shared-form-header"
import { createProductRequestAction, findCatalogueMatchesAction } from "@/lib/actions/product-request.actions"
import { NEW_BRAND, PRODUCT_REQUEST_LIMITS, productRequestFormSchema } from "@/lib/schemas/product-request.schemas"
import type { CatalogueMatch, SelectItem } from "@/types"

type FormInput = z.input<typeof productRequestFormSchema>
type FormOutput = z.output<typeof productRequestFormSchema>

const BACK_TO = "/store/product-requests"

// How long typing pauses before the catalogue is searched for what it might be
const MATCH_DELAY_MS = 400

interface ProductRequestFormProps {
  storeId: string
  brands: SelectItem[]
  categories: { options: CascaderOption[]; disabledIds: string[] }
}

// Catalogue products matching the name or barcode typed so far, so the store can list one instead of asking
function useCatalogueMatches(storeId: string, name: string, barcode: string) {
  const [matches, setMatches] = useState<CatalogueMatch[]>([])
  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      if (name.trim().length < 3 && barcode.trim().length < 3) {
        setMatches([])
        return
      }
      findCatalogueMatchesAction({ storeId, name, barcode })
        .then((response) => {
          if (current && response.success) setMatches(response.data)
        })
        .catch((error) => console.error("Could not look for matching products:", error))
    }, MATCH_DELAY_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [storeId, name, barcode])
  return matches
}

export default function ProductRequestForm({ storeId, brands, categories }: ProductRequestFormProps) {
  const router = useRouter()
  // Keeps the form locked from a successful save until the page changes
  const [isSaved, setIsSaved] = useState(false)

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(productRequestFormSchema),
    defaultValues: { name: "", brandId: "", brandName: "", categoryId: "", barcode: "", link: "", notes: "" },
  })

  const [name = "", barcode = "", brandId] = useWatch({ control: form.control, name: ["name", "barcode", "brandId"] })
  const matches = useCatalogueMatches(storeId, name, barcode ?? "")

  const onSubmit: SubmitHandler<FormOutput> = async (values) => {
    const response = await createProductRequestAction({ ...values, storeId })
    if (!response.success) {
      toast.add({ title: "Unable to send the request", description: response.error, type: "error" })
      return
    }
    setIsSaved(true)
    router.push(BACK_TO)
    toast.add({ title: "Request sent", description: `The platform's team will add ${values.name} or tell you why not.`, type: "success" })
  }

  const isBusy = form.formState.isSubmitting || isSaved
  const brandOptions = [{ value: "", label: "Not sure" }, ...brands.map((brand) => ({ value: brand.id, label: brand.name })), { value: NEW_BRAND, label: "Not in this list" }]

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-y-6">
        <SharedFormHeader
          heading="Request a Product"
          description="Ask the platform to add a product to the catalogue."
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
                  <CardTitle>Product</CardTitle>
                  <CardDescription>Only the name is required.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <TextInputField
                      control={form.control}
                      label="Name"
                      name="name"
                      placeholder="e.g. Seagate Expansion 4TB Portable Drive"
                      showCount
                      maxLength={PRODUCT_REQUEST_LIMITS.name}
                      disabled={isBusy}
                    />
                    <SelectField control={form.control} label="Brand" name="brandId" options={brandOptions} placeholder="Not sure" disabled={isBusy} />
                    {brandId === NEW_BRAND && <TextInputField control={form.control} label="Brand's name" name="brandName" maxLength={PRODUCT_REQUEST_LIMITS.brandName} disabled={isBusy} />}
                    <CascaderField
                      control={form.control}
                      label="Category"
                      name="categoryId"
                      options={categories.options}
                      disabledOptions={categories.disabledIds}
                      leafOnly={false}
                      clearable
                      placeholder="Not sure"
                      description="Where you'd look for it, if you know."
                      disabled={isBusy}
                    />
                    <div className="grid gap-5 sm:grid-cols-2">
                      <TextInputField control={form.control} label="Barcode or part number" name="barcode" placeholder="Optional" maxLength={PRODUCT_REQUEST_LIMITS.barcode} disabled={isBusy} />
                      <TextInputField control={form.control} label="Link" name="link" placeholder="The maker's page or a supplier's listing" disabled={isBusy} />
                    </div>
                    <TextareaField
                      control={form.control}
                      label="Notes"
                      name="notes"
                      placeholder="e.g. Customers keep asking for the 4 TB one"
                      showCount
                      maxLength={PRODUCT_REQUEST_LIMITS.notes}
                      disabled={isBusy}
                    />
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>

            <div className="grid auto-rows-max gap-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Already in the catalogue?</CardTitle>
                  <CardDescription>{matches.length ? "If it's one of these, list it instead." : "Matching products show here."}</CardDescription>
                </CardHeader>
                {matches.length > 0 && (
                  <CardContent>
                    <ul className="grid gap-3">
                      {matches.map((match) => (
                        <li key={match.id} className="flex items-center gap-3">
                          <div className="size-10 shrink-0 overflow-hidden rounded bg-muted">{match.image && <img alt="" src={match.image} className="size-full object-cover" />}</div>
                          <div className="grid min-w-0 flex-1 gap-0.5">
                            <Link href={`/store/products/${match.id}`} className="truncate text-sm font-medium underline-offset-4 hover:underline">
                              {match.name}
                            </Link>
                            <span className="text-xs text-muted-foreground">{match.brandName}</span>
                          </div>
                          {match.listingId ? (
                            <Link href={`/store/listings/${match.listingId}/edit`} className={buttonVariants({ variant: "ghost", size: "xs" })}>
                              Listed
                            </Link>
                          ) : (
                            <Link href={`/store/listings/add?productId=${match.id}`} className={buttonVariants({ variant: "outline", size: "xs" })}>
                              List it
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>

          <SharedFormFooter backTo={BACK_TO} isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={() => router.push(BACK_TO)} />
        </div>
      </div>
    </form>
  )
}
