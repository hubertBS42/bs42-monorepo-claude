"use client"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { FieldGroup } from "@workspace/ui/components/field"
import { CONDITION_OPTIONS, STATUS_OPTIONS } from "@/constants"
import { addProductFormSchema } from "@/lib/schemas/product.schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Control, FieldErrors, SubmitErrorHandler, SubmitHandler, useFieldArray, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { toast } from "@workspace/ui/components/toast"
import SharedFormHeader from "@/components/shared-form-header"
import { ProductReviewsCard } from "@/components/product-reviews-card"
import { StorefrontLinkCard } from "@/components/storefront-link-card"
import type { ProductReviewStats } from "@/lib/data/reviews.data"
import type { StorefrontLink } from "@/lib/data/storefront-links.data"
import SharedFormFooter from "@/components/shared-form-footer"
import { Condition, InstallationOption, Status } from "@workspace/db/enums"
import { formatCurrency } from "@workspace/utils/currency"
import { createProductAction, updateProductAction } from "@/lib/actions/product.actions"
import { CascaderField, ComboboxField, DocumentField, ImageField, NumberInputField, RichTextField, SelectField, SwitchField, TagsField, TextInputField, type CascaderOption } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Pencil, PlusCircle, Trash2, X } from "lucide-react"
import { Label } from "@workspace/ui/components/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Badge } from "@workspace/ui/components/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import type { ProductFormData, SelectItem, SpecField, VariantUsage } from "@/types"
import VariantSheet from "./variant-sheet"
import ProductSpecs from "./product-specs"
import DeleteProduct from "./delete-product"
import { deleteDocuments, deleteFiles, deleteImages, uploadDocuments, uploadImages } from "@/lib/storage"

type FormInput = z.input<typeof addProductFormSchema>
type FormOutput = z.output<typeof addProductFormSchema>
type VariantInput = NonNullable<FormInput["variants"]>[number]
type OptionInput = NonNullable<FormInput["variantOptions"]>[number]

interface ProductFormProps {
  brands: SelectItem[]
  // The category tree from getCategoryOptions
  categoryOptions: CascaderOption[]
  disabledCategoryIds: string[]
  // Each category's specs, its own and those above it (getSpecFieldsByCategory)
  specFields: Record<string, SpecField[]>
  // Each category's installation fee in GHS, its own or the nearest above it (getInstallationFeesByCategory)
  categoryInstallationFees: Record<string, number>
  // The product being edited; without it the form adds a new one
  product?: ProductFormData
  // Its storefront page and its reviews, when editing
  storefrontLink?: StorefrontLink
  reviewStats?: ProductReviewStats
}

const EMPTY_PRODUCT: FormInput = {
  name: "",
  // The editor reports an empty document as null, so anything else here makes the form dirty on load
  description: null,
  tags: [],
  documents: [],
  categoryId: "",
  brandId: "",
  baseSellPrice: 0,
  baseBuyPrice: 0,
  sku: "",
  barcode: "",
  dimensions: "",
  weight: null,
  hasVariants: false,
  status: Status.DRAFT,
  condition: Condition.NEW,
  installation: InstallationOption.CATEGORY,
  installationFeeGhs: null,
  images: [],
  banner: "",
  variantOptions: [],
  variants: [],
  specs: {},
}

// Every combination of the options' values, skipping blank ones, e.g. Size S/L × Colour Red gives two. Values are
// used as typed: the schema matches attributes against the option values exactly.
function getCombinations(options: OptionInput[]): Record<string, string>[] {
  return options
    .reduce<Record<string, string>[]>(
      (combinations, option) => {
        const values = option.values.map((value) => value.value).filter((value) => value.trim())
        if (!option.name.trim() || values.length === 0) return combinations
        return combinations.flatMap((combination) => values.map((value) => ({ ...combination, [option.name]: value })))
      },
      [{}]
    )
    .filter((combination) => Object.keys(combination).length > 0)
}

// The same attributes give the same key whatever order they were added in
const attributesKey = (attributes: Record<string, string>) => JSON.stringify(Object.entries(attributes).sort(([a], [b]) => a.localeCompare(b)))

const renameKey = (attributes: Record<string, string>, from: string, to: string) => Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key === from ? to : key, value]))

const newVariant = (attributes: Record<string, string>, position: number): VariantInput => ({
  sku: "",
  barcode: "",
  dimensions: "",
  weight: null,
  attributes,
  position,
  images: [],
})

// Field array errors land on the array itself or, from the resolver, on its root
const arrayErrorMessage = (error: { message?: string; root?: { message?: string } } | undefined) => error?.message ?? error?.root?.message

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// What removing these saved variants does once the product is saved, or nothing when none of them is in use
function describeRemoval(variants: VariantInput[], usage: Record<string, VariantUsage>): string[] {
  const used = variants.flatMap((variant) => (variant.id && usage[variant.id] ? [usage[variant.id]!] : []))
  const ordered = used.filter((item) => item.ordered).length
  const listings = used.filter((item) => !item.ordered).reduce((total, item) => total + item.storeCount, 0)
  return [
    ...(ordered ? [`${plural(ordered, "variant has", "variants have")} been ordered or bought in, so ${ordered === 1 ? "it" : "they"} will be archived instead of deleted.`] : []),
    ...(listings ? [`${plural(listings, "store listing loses", "store listings lose")} the price and stock set for ${ordered ? "the others" : "them"}.`] : []),
  ]
}

type PendingChange = { kind: "removeVariant"; index: number } | { kind: "regenerate" } | { kind: "noVariants" }

const ProductForm = ({ brands, categoryOptions, disabledCategoryIds, specFields, categoryInstallationFees, product, storefrontLink, reviewStats }: ProductFormProps) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null)
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null)

  const isEditing = !!product
  // Saved files are removed by the server when the update replaces them; only this form's uploads are deleted here
  const savedFiles = useMemo(() => new Set(product?.savedFiles), [product])
  const savedFileList = useMemo(() => [...savedFiles], [savedFiles])
  const variantUsage = useMemo(() => product?.variantUsage ?? {}, [product])

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(addProductFormSchema),
    defaultValues: product?.values ?? EMPTY_PRODUCT,
  })

  const { fields: optionFields, append: appendOption, remove: removeOption, replace: replaceOptions } = useFieldArray({ control: form.control, name: "variantOptions" })
  const { fields: variantFields, remove: removeVariant, replace: replaceVariants } = useFieldArray({ control: form.control, name: "variants" })

  const hasVariants = useWatch({ control: form.control, name: "hasVariants" })
  const categoryId = useWatch({ control: form.control, name: "categoryId" })
  const installation = useWatch({ control: form.control, name: "installation" })
  const categoryFee = categoryInstallationFees[categoryId]
  const installationOptions = [
    {
      value: InstallationOption.CATEGORY,
      label: !categoryId ? "The category's fee" : categoryFee ? `The category's fee (${formatCurrency(String(categoryFee), "GHS", "en-GH")})` : "The category's fee (it has none: not offered)",
    },
    { value: InstallationOption.OWN, label: "Its own fee" },
    { value: InstallationOption.NONE, label: "Not offered" },
  ]
  const watchedOptions = useWatch({ control: form.control, name: "variantOptions" })
  const watchedVariants = useWatch({ control: form.control, name: "variants" })
  const variantOptions = useMemo(() => watchedOptions ?? [], [watchedOptions])
  const variants = useMemo(() => watchedVariants ?? [], [watchedVariants])

  const combinations = useMemo(() => getCombinations(variantOptions), [variantOptions])

  // Renaming an option or a value renames it in the variants too, so they stay the same variants (with their SKUs,
  // images and store listings) instead of going stale. Adding or removing options or values still needs a regenerate.
  const previousOptions = useRef(variantOptions)
  useEffect(() => {
    const previous = previousOptions.current
    previousOptions.current = variantOptions
    if (previous === variantOptions || previous.length !== variantOptions.length) return

    const current = form.getValues("variants") ?? []
    let next = current.map((variant) => variant.attributes)
    variantOptions.forEach((option, optionIndex) => {
      const before = previous[optionIndex]
      if (!before) return
      if (before.name !== option.name) next = next.map((attributes) => (before.name in attributes ? renameKey(attributes, before.name, option.name) : attributes))
      if (before.values.length !== option.values.length) return
      option.values.forEach((value, valueIndex) => {
        const old = before.values[valueIndex]?.value
        if (old !== undefined && old !== value.value) next = next.map((attributes) => (attributes[option.name] === old ? { ...attributes, [option.name]: value.value } : attributes))
      })
    })
    next.forEach((attributes, index) => {
      if (attributes !== current[index]?.attributes) form.setValue(`variants.${index}.attributes`, attributes, { shouldDirty: true })
    })
  }, [variantOptions, form])

  // Editing the options after generating leaves variants that no longer match them, which the schema would reject on save
  const isStale = useMemo(() => {
    if (variants.length === 0) return false
    const expected = new Set(combinations.map(attributesKey))
    return expected.size !== variants.length || variants.some((variant) => !expected.has(attributesKey(variant.attributes)))
  }, [combinations, variants])

  const brandOptions = useMemo(() => brands.map((brand) => ({ label: brand.name, value: brand.id })), [brands])

  const isBusy = isPending
  const { errors } = form.formState

  // Best effort: anything left behind is removed by the orphaned-file sweep
  const deleteUnsavedImages = async (urls: string[]) => {
    const unsaved = urls.filter((url) => !savedFiles.has(url))
    if (unsaved.length === 0) return
    try {
      await deleteImages(unsaved)
    } catch {
      // Left to the sweep
    }
  }

  // The variants a regenerate would drop: combinations that no longer exist
  const getDroppedVariants = () => {
    const keptKeys = new Set(combinations.map(attributesKey))
    return (form.getValues("variants") ?? []).filter((variant) => !keptKeys.has(attributesKey(variant.attributes)))
  }

  // Combinations that already have a variant keep it (its id, SKU, images and details); only the dropped ones go
  const generateVariants = async () => {
    const current = form.getValues("variants") ?? []
    const byKey = new Map(current.map((variant) => [attributesKey(variant.attributes), variant]))
    const next = combinations.map((attributes, position) => {
      const existing = byKey.get(attributesKey(attributes))
      return existing ? { ...existing, attributes, position } : newVariant(attributes, position)
    })
    const droppedImages = getDroppedVariants().flatMap((variant) => variant.images)

    setEditingVariantIndex(null)
    replaceVariants(next)
    if (form.formState.isSubmitted) void form.trigger("variants")
    await deleteUnsavedImages(droppedImages)
  }

  const removeVariantAt = async (index: number) => {
    const images = form.getValues(`variants.${index}.images`) ?? []
    setEditingVariantIndex(null)
    removeVariant(index)
    await deleteUnsavedImages(images)
  }

  const removeAllVariants = async () => {
    const images = (form.getValues("variants") ?? []).flatMap((variant) => variant.images)
    setEditingVariantIndex(null)
    replaceOptions([])
    replaceVariants([])
    form.setValue("hasVariants", false, { shouldDirty: true })
    form.clearErrors(["variantOptions", "variants"])
    await deleteUnsavedImages(images)
  }

  // Changes that would archive or unlist saved variants are confirmed first; the rest happen straight away
  const handleGenerateVariants = () => {
    if (describeRemoval(getDroppedVariants(), variantUsage).length) setPendingChange({ kind: "regenerate" })
    else void generateVariants()
  }

  const handleRemoveVariant = (index: number) => {
    const variant = form.getValues(`variants.${index}`)
    if (variant && describeRemoval([variant], variantUsage).length) setPendingChange({ kind: "removeVariant", index })
    else void removeVariantAt(index)
  }

  const handleHasVariantsChange = (checked: boolean) => {
    if (checked) {
      // A product with variants keeps these per variant
      form.setValue("sku", "")
      form.setValue("barcode", "")
      form.setValue("dimensions", "")
      form.setValue("weight", null)
      return
    }

    // Turning variants off throws away the options and variants, so ask first when there's something to lose
    if (variantOptions.length > 0 || variants.length > 0) {
      form.setValue("hasVariants", true)
      setPendingChange({ kind: "noVariants" })
    }
  }

  const handleConfirmPendingChange = async () => {
    const change = pendingChange
    setPendingChange(null)
    if (change?.kind === "regenerate") await generateVariants()
    else if (change?.kind === "removeVariant") await removeVariantAt(change.index)
    else if (change?.kind === "noVariants") await removeAllVariants()
  }

  const pendingVariants = !pendingChange
    ? []
    : pendingChange.kind === "removeVariant"
      ? variants.slice(pendingChange.index, pendingChange.index + 1)
      : pendingChange.kind === "regenerate"
        ? getDroppedVariants()
        : variants
  const pendingConsequences = describeRemoval(pendingVariants, variantUsage)

  const onSubmit: SubmitHandler<FormOutput> = (productData) => {
    // Positions follow the order on screen, whatever was added or removed along the way
    const payload = {
      ...productData,
      variantOptions: productData.variantOptions?.map((option, optionIndex) => ({
        ...option,
        position: optionIndex,
        values: option.values.map((value, valueIndex) => ({ ...value, position: valueIndex })),
      })),
      variants: productData.variants?.map((variant, position) => ({ ...variant, position })),
    }

    startTransition(async () => {
      const response = product ? await updateProductAction({ ...payload, id: product.id }) : await createProductAction(payload)

      if (response.success) {
        toast.add(
          product
            ? { title: "Product updated", description: "Your changes have been saved.", type: "success" }
            : { title: "Product created", description: `${productData.name} has been added to the catalogue.`, type: "success" }
        )
        router.push("/catalogue/products")
        return
      }

      // A product with variants doesn't say which variant clashed, so that one goes in a toast
      if (response.code === "SKU_EXISTS" && !productData.hasVariants) form.setError("sku", { type: "custom", message: response.error })
      else if (response.code === "BARCODE_EXISTS" && !productData.hasVariants) form.setError("barcode", { type: "custom", message: response.error })
      else if (response.code === "INVALID_BRAND") form.setError("brandId", { type: "custom", message: response.error })
      else if (response.code === "INVALID_CATEGORY") form.setError("categoryId", { type: "custom", message: response.error })
      // A spec or option changed since the page loaded: the message names the spec
      else if (response.code === "INVALID_SPEC") toast.add({ title: "Check the specifications", description: response.error, type: "error" })
      else toast.add({ title: "Operation failed", description: response.error, type: "error" })
    })
  }

  // Variant errors only show inside a variant's sheet, so say where to look
  const onInvalid: SubmitErrorHandler<FormInput> = (formErrors: FieldErrors<FormInput>) => {
    if (formErrors.variants || formErrors.variantOptions) {
      toast.add({ title: "Check the variants", description: "Some variant options or variants need attention.", type: "error" })
    }
  }

  const handleAddImages = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return uploadImages(formData)
  }

  const handleRemoveImage = async (url: string) => {
    if (savedFiles.has(url)) return
    await deleteImages([url])
  }

  const handleAddDocuments = async (data: FileList) => {
    const formData = new FormData()
    Array.from(data).forEach((file) => formData.append("files", file))
    return uploadDocuments(formData)
  }

  const handleRemoveDocument = async (url: string) => {
    if (savedFiles.has(url)) return
    await deleteDocuments([url])
  }

  const handleDiscard = () => {
    startTransition(async () => {
      const values = form.getValues()
      const uploads = [...values.images, ...(values.variants ?? []).flatMap((variant) => variant.images), ...values.documents.map((document) => document.url)].filter((url) => !savedFiles.has(url))

      try {
        if (uploads.length) await deleteFiles(uploads)
        router.push("/catalogue/products")
      } catch (error) {
        toast.add({
          title: isEditing ? "Unable to discard changes" : "Unable to discard product",
          description: error instanceof Error ? error.message : "The uploaded files could not be removed. Please try again.",
          type: "error",
        })
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
      <div className="grid gap-y-6">
        <SharedFormHeader
          heading={isEditing ? "Edit Product" : "Add Product"}
          description={isEditing ? "Edit this product." : "Create a new product."}
          backTo="/catalogue/products"
          isPending={isBusy}
          isDirty={form.formState.isDirty}
          handleDiscard={handleDiscard}
        />

        <div className="grid gap-8">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {/* Left column */}
            <div className="grid auto-rows-max gap-y-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Product Details</CardTitle>
                  <CardDescription>Configure the basic information for this product.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <TextInputField control={form.control} label="Name" name="name" disabled={isBusy} autoFocus={!isEditing} />

                    <RichTextField control={form.control} label="Description" name="description" placeholder="Provide a description" disabled={isBusy} />

                    <div className="grid gap-5 sm:grid-cols-2">
                      <ComboboxField control={form.control} label="Brand" name="brandId" disabled={isBusy} options={brandOptions} placeholder="Select brand" emptyMessage="No brands found." />

                      <SelectField control={form.control} label="Condition" name="condition" disabled={isBusy} options={CONDITION_OPTIONS} />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <NumberInputField control={form.control} label="Buy price" name="baseBuyPrice" step={0.01} min={0} prependText="$" disabled={isBusy} />
                      <NumberInputField control={form.control} label="Sell price" name="baseSellPrice" step={0.01} min={0} prependText="$" disabled={isBusy} />
                    </div>

                    <CascaderField
                      control={form.control}
                      label="Category"
                      name="categoryId"
                      options={categoryOptions}
                      disabledOptions={disabledCategoryIds}
                      leafOnly
                      clearable
                      disabled={isBusy}
                      placeholder="Select a category"
                      description="Products go in the most specific category, one without subcategories."
                    />

                    <TagsField control={form.control} label="Tags" name="tags" placeholder="Add tag and press Enter..." disabled={isBusy} />
                  </FieldGroup>
                </CardContent>
              </Card>

              <ProductSpecs control={form.control} fields={specFields[categoryId] ?? []} hasCategory={!!categoryId} disabled={isBusy} />

              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>Settings for this product.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SwitchField
                    control={form.control}
                    variant="card"
                    label="Has variants"
                    name="hasVariants"
                    disabled={isBusy}
                    description="Product has multiple variants (color, size, etc.)"
                    onChange={handleHasVariantsChange}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Installation</CardTitle>
                  <CardDescription>What customers pay to have one installed by the platform&apos;s installers, where Settings → Delivery says they work.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <SelectField control={form.control} label="Installation" name="installation" disabled={isBusy} options={installationOptions} />
                    {installation === InstallationOption.OWN && (
                      <NumberInputField control={form.control} label="Fee per item" name="installationFeeGhs" step={0.01} min={0} prependText="GH₵" disabled={isBusy} />
                    )}
                  </div>
                </CardContent>
              </Card>

              {!hasVariants && (
                <Card>
                  <CardHeader>
                    <CardTitle>Product Identification & Shipping</CardTitle>
                    <CardDescription>SKU, barcode and shipping details for this product.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <TextInputField control={form.control} label="SKU" name="sku" disabled={isBusy} placeholder="Leave empty to auto-generate" />
                        <TextInputField control={form.control} label="Barcode" name="barcode" disabled={isBusy} placeholder="e.g. 123456789" />
                      </div>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <NumberInputField control={form.control} label="Weight (kg)" name="weight" step={0.01} min={0} disabled={isBusy} />
                        <TextInputField control={form.control} label="Dimensions" name="dimensions" disabled={isBusy} placeholder="e.g. 10x5x3 cm" />
                      </div>
                    </FieldGroup>
                  </CardContent>
                </Card>
              )}

              {hasVariants && (
                <Card>
                  <CardHeader>
                    <CardTitle>Variant Options</CardTitle>
                    <CardDescription>Define variant types (Color, Size, etc.)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      {optionFields.map((field, optionIndex) => (
                        <div key={field.id} className="rounded-lg border p-4">
                          <div className="mb-4 flex items-start justify-between gap-2">
                            <TextInputField
                              control={form.control}
                              placeholder="Option name (e.g., Color)"
                              aria-label="Option name"
                              name={`variantOptions.${optionIndex}.name`}
                              disabled={isBusy}
                              className="max-w-xs"
                            />

                            <Button type="button" variant="ghost" size="icon" aria-label="Remove option" disabled={isBusy} onClick={() => removeOption(optionIndex)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>

                          <OptionValues control={form.control} optionIndex={optionIndex} disabled={isBusy} error={arrayErrorMessage(errors.variantOptions?.[optionIndex]?.values)} />
                        </div>
                      ))}

                      <Button type="button" variant="outline" disabled={isBusy} onClick={() => appendOption({ name: "", position: optionFields.length, values: [] })}>
                        <PlusCircle className="mr-2 size-4" />
                        Add Option
                      </Button>

                      {arrayErrorMessage(errors.variantOptions) && <p className="text-sm text-destructive">{arrayErrorMessage(errors.variantOptions)}</p>}
                    </FieldGroup>
                  </CardContent>
                  <CardFooter className="grid justify-center gap-2 border-t p-4 text-center">
                    <Button type="button" size="sm" variant="ghost" onClick={handleGenerateVariants} disabled={isBusy || combinations.length === 0}>
                      <PlusCircle className="mr-2 size-3.5" />
                      {variants.length ? "Regenerate" : "Generate"} Variants
                    </Button>
                    {isStale && <p className="text-sm text-destructive">The options have changed since the variants were generated. Regenerate them to match.</p>}
                    {arrayErrorMessage(errors.variants) && <p className="text-sm text-destructive">{arrayErrorMessage(errors.variants)}</p>}
                  </CardFooter>
                </Card>
              )}

              {hasVariants && variantFields.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Variants</CardTitle>
                    <CardDescription>Manage individual product variants</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Attributes</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Images</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variantFields.map((field, index) => {
                          const variant = variants[index]
                          const usage = variant?.id ? variantUsage[variant.id] : undefined
                          const usageText = [usage?.ordered && "Ordered", usage?.storeCount && `In ${plural(usage.storeCount, "store", "stores")}`].filter(Boolean).join(" · ")
                          const rowErrors = errors.variants?.[index]
                          // attributes is a record, so its error type also allows an attribute called "message"
                          const attributesMessage = rowErrors?.attributes?.message
                          const rowError = rowErrors ? (typeof attributesMessage === "string" ? attributesMessage : "This variant has errors. Edit it to see them.") : undefined

                          return (
                            <TableRow key={field.id} data-invalid={!!rowError || undefined} className="data-invalid:bg-destructive/5">
                              <TableCell>
                                <div className="flex flex-wrap gap-1 text-sm">
                                  {Object.entries(variant?.attributes ?? {}).map(([key, value]) => (
                                    <Badge key={key} variant="secondary">
                                      {key}: {value}
                                    </Badge>
                                  ))}
                                </div>
                                {usageText && <p className="mt-1 text-xs text-muted-foreground">{usageText}</p>}
                                {rowError && <p className="mt-1 text-xs text-destructive">{rowError}</p>}
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-sm">{variant?.sku || <span className="text-xs text-muted-foreground italic">Auto-generated</span>}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">{variant?.images?.length ?? 0} image(s)</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button type="button" variant="ghost" size="icon" aria-label="Edit variant" disabled={isBusy} onClick={() => setEditingVariantIndex(index)}>
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" aria-label="Remove variant" disabled={isBusy} onClick={() => handleRemoveVariant(index)}>
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    {editingVariantIndex !== null && (
                      <VariantSheet
                        open={editingVariantIndex !== null}
                        onOpenChange={(open) => !open && setEditingVariantIndex(null)}
                        index={editingVariantIndex}
                        control={form.control}
                        attributes={variants[editingVariantIndex]?.attributes ?? {}}
                        savedImages={savedFileList}
                        clearErrors={form.clearErrors}
                      />
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column */}
            <div className="grid auto-rows-max gap-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                  <CardDescription>Set the status for this product.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SelectField control={form.control} name="status" aria-label="Status" disabled={isBusy} options={STATUS_OPTIONS} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Images</CardTitle>
                  <CardDescription>Upload product images</CardDescription>
                </CardHeader>
                <CardContent>
                  <ImageField
                    control={form.control}
                    name="images"
                    sizeLimit={100}
                    maxImages={4}
                    onAdd={handleAddImages}
                    onRemove={handleRemoveImage}
                    clearErrors={form.clearErrors}
                    disabled={isBusy}
                    className="w-full"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Documents</CardTitle>
                  <CardDescription>Attach product related documents.</CardDescription>
                </CardHeader>
                <CardContent>
                  <DocumentField
                    control={form.control}
                    name="documents"
                    maxFiles={5}
                    sizeLimit={5000}
                    onAdd={handleAddDocuments}
                    onRemove={handleRemoveDocument}
                    clearErrors={form.clearErrors}
                    disabled={isBusy}
                  />
                </CardContent>
              </Card>

              {storefrontLink && <StorefrontLinkCard link={storefrontLink} description="As customers see it, with the best offer across the stores selling it. Saved changes show within a minute." />}

              {product && reviewStats && <ProductReviewsCard productId={product.id} stats={reviewStats} />}

              {product && (
                <Card>
                  <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>Delete this product. A product that has been ordered can only be archived.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DeleteProduct product={{ id: product.id, name: product.name }} storeCount={product.storeCount} hasOrders={product.hasOrders} />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <SharedFormFooter backTo="/catalogue/products" isPending={isBusy} isDirty={form.formState.isDirty} handleDiscard={handleDiscard} />
        </div>
      </div>

      <AlertDialog open={pendingChange !== null} onOpenChange={(open) => !open && setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingChange?.kind === "noVariants" ? "Remove all variants?" : pendingChange?.kind === "regenerate" ? "Regenerate variants?" : "Remove this variant?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange?.kind === "noVariants"
                ? "Turning variants off removes this product's options, variants and their images."
                : pendingChange?.kind === "regenerate"
                  ? `${plural(pendingVariants.length, "variant no longer matches", "variants no longer match")} the options and will be removed.`
                  : "This variant will be removed."}
              {pendingConsequences.map((line) => ` ${line}`)}
              {isEditing && " Nothing changes until you save."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPendingChange}>{pendingChange?.kind === "regenerate" ? "Regenerate" : "Remove"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

// Its own field array, so each value row keeps a stable key when one above it is removed
const OptionValues = ({ control, optionIndex, disabled, error }: { control: Control<FormInput, unknown, FormOutput>; optionIndex: number; disabled: boolean; error?: string }) => {
  const { fields, append, remove } = useFieldArray({ control, name: `variantOptions.${optionIndex}.values` })

  return (
    <div className="space-y-2">
      <Label>Values</Label>
      {fields.map((field, valueIndex) => (
        <div key={field.id} className="flex gap-2">
          <TextInputField control={control} placeholder="Value (e.g., Red)" aria-label="Value" name={`variantOptions.${optionIndex}.values.${valueIndex}.value`} disabled={disabled} />

          <Button type="button" variant="ghost" size="icon" aria-label="Remove value" disabled={disabled} onClick={() => remove(valueIndex)}>
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => append({ value: "", position: fields.length })}>
        <PlusCircle className="mr-2 size-4" />
        Add Value
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export default ProductForm
