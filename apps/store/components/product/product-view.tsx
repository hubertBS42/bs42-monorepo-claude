"use client"

import { useState } from "react"
import Link from "next/link"
import { FileText, Package, Truck, Wrench } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

import { AddToBasketButton } from "@/components/basket/add-to-basket"
import { QuantityStepper } from "@/components/basket/quantity-stepper"
import { MAX_LINE_QUANTITY } from "@/lib/basket-limits"
import { CompareToggle } from "@/components/compare/compare-toggle"
import { OfferPrice, OfferStock } from "@/components/offer-details"
import { RatingLine } from "@/components/reviews/stars"
import { useOfferPicker } from "@/components/use-offer-picker"
import { WishListHeart } from "@/components/wish-list/wish-list-heart"
import { CONDITION_LABELS } from "@/lib/conditions"
import type { ProductDetails } from "@/lib/data/product-details"
import { formatGhs } from "@/lib/money"
import { isInStock, type PricedCard } from "@/lib/product-cards"

// The buy box lists this many specs; the Specifications tab has them all
const KEY_SPECS = 6

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [current, setCurrent] = useState(0)
  const image = images[current]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
          <img src={image} alt={name} className="size-full object-contain p-6" />
        ) : (
          <Package className="size-24 text-muted-foreground/40" aria-hidden />
        )}
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((url, index) => (
            <li key={url} className="shrink-0">
              <button
                type="button"
                onClick={() => setCurrent(index)}
                aria-label={`Image ${index + 1}`}
                aria-current={index === current || undefined}
                className={cn("flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted", index === current && "ring-2 ring-ring")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image */}
                <img src={url} alt="" className="size-full object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ProductView({
  card,
  details,
  initialVariantId,
  description,
  freeDeliveryFromGhs,
  installation,
}: {
  card: PricedCard
  details: ProductDetails
  initialVariantId: string | null
  // Rendered on the server (RichTextContent)
  description: React.ReactNode
  freeDeliveryFromGhs: string | null
  // Installing one unit (with tax when it's on) and where installers work; null when it isn't offered
  installation: { unitGhs: string; areas: string } | null
}) {
  const { offer, options } = useOfferPicker(card, initialVariantId)
  const [quantity, setQuantity] = useState(1)
  const [withInstallation, setWithInstallation] = useState(false)
  const canBuy = !!offer.price && isInStock(offer)

  const variant = offer.variantId ? details.variants[offer.variantId] : undefined
  const facts = variant ?? details.facts
  // The variant's own images first, then the product's
  const images = [...new Set([...(variant?.images ?? []), ...details.images])]

  // The variant goes in the URL, so the page can be shared and reloaded as it is, without a server round trip
  const pick = (choose: () => { variantId: string | null }) => {
    const next = choose()
    setQuantity(1)
    if (next.variantId) window.history.replaceState(null, "", `?variant=${next.variantId}`)
  }

  const specRows = [
    ...card.specs.map((spec) => ({ name: spec.name, value: spec.label })),
    { name: "Brand", value: card.brand.name },
    { name: "Condition", value: CONDITION_LABELS[card.condition] },
    ...(facts.sku ? [{ name: "SKU", value: facts.sku }] : []),
    ...(facts.barcode ? [{ name: "Barcode", value: facts.barcode }] : []),
    ...(facts.weightKg ? [{ name: "Weight", value: `${facts.weightKg} kg` }] : []),
    ...(facts.dimensions ? [{ name: "Dimensions", value: facts.dimensions }] : []),
  ]
  const values = options.flatMap((option) => option.values.filter((value) => value.selected).map((value) => value.value))
  const label = values.length ? `${card.name} (${values.join(", ")})` : card.name
  // The basket caps it at what the store has; this only stops the stepper going past a low stock count shown
  const maxQuantity = offer.stock.kind === "in-stock" ? Math.min(offer.stock.left ?? MAX_LINE_QUANTITY, MAX_LINE_QUANTITY) : 1

  const tabs = [...(description ? ["description"] : []), "specifications", ...(details.documents.length ? ["documents"] : [])]

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        {/* Keyed by variant, so a new variant's gallery starts on its first image */}
        <Gallery key={offer.variantId ?? "product"} images={images} name={card.name} />

        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <Link href={`/b/${card.brand.slug}`} className="text-sm font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground">
              {card.brand.name}
            </Link>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{card.name}</h1>
            {card.numReviews > 0 && (
              <a href="#reviews" className="block w-fit rounded-sm hover:underline hover:underline-offset-4">
                <RatingLine rating={card.rating} count={card.numReviews} />
              </a>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {offer.price?.wasGhs && <Badge variant="destructive">Sale</Badge>}
              {card.condition !== "NEW" && <Badge variant="secondary">{CONDITION_LABELS[card.condition]}</Badge>}
              {facts.sku && <span className="text-sm text-muted-foreground">SKU {facts.sku}</span>}
            </div>
          </div>

          <div className="space-y-2">
            <OfferPrice offer={offer} size="lg" />
            <OfferStock offer={offer} size="lg" />
          </div>

          {options.map((option) => (
            <fieldset key={option.name} className="space-y-2">
              <legend className="mb-2 text-sm">
                <span className="font-semibold">{option.name}:</span> {option.values.find((value) => value.selected)?.value}
              </legend>
              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => (
                  <button
                    key={value.id}
                    type="button"
                    onClick={() => pick(value.pick)}
                    aria-pressed={value.selected}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-foreground/40",
                      value.selected && "border-foreground bg-foreground text-background hover:border-foreground",
                      !value.available && "border-dashed text-muted-foreground"
                    )}
                  >
                    {value.value}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            {canBuy && <QuantityStepper value={Math.min(quantity, maxQuantity)} max={maxQuantity} onChange={setQuantity} label="Quantity" className="h-10" />}
            <AddToBasketButton
              offer={offer}
              label={label}
              quantity={Math.min(quantity, maxQuantity)}
              installation={withInstallation}
              onAdded={() => setQuantity(1)}
              size="lg"
              className="min-w-48 flex-1 sm:flex-none"
            />
            <WishListHeart item={{ productId: card.id, variantId: offer.variantId }} label={label} appearance="button" />
            <CompareToggle pick={{ id: card.id, name: card.name, slug: card.slug, image: card.image, categoryId: card.categoryId }} className="text-sm" />
          </div>

          {installation && canBuy && (
            <label className="flex w-fit cursor-pointer gap-3 rounded-xl border p-4 text-sm has-data-checked:border-foreground/40">
              <Checkbox checked={withInstallation} onCheckedChange={setWithInstallation} className="mt-0.5" />
              <span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Wrench className="size-4 text-muted-foreground" aria-hidden />
                  Add installation, {formatGhs(installation.unitGhs)} per item
                </span>
                <span className="block text-muted-foreground">Our installers fit it for you. Available in {installation.areas}; we'll call to arrange a day.</span>
              </span>
            </label>
          )}

          {card.specs.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-muted/50 p-4 text-sm">
              {card.specs.slice(0, KEY_SPECS).map((spec) => (
                <div key={spec.specId} className="contents">
                  <dt className="text-muted-foreground">{spec.name}</dt>
                  <dd className="font-medium">{spec.label}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="flex gap-3 rounded-xl border p-4 text-sm">
            <Truck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-semibold">Delivery across Ghana</p>
              <p className="text-muted-foreground">
                The fee depends on where you are and is added at checkout.
                {freeDeliveryFromGhs && ` Free on orders of ${formatGhs(freeDeliveryFromGhs)} or more.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue={tabs[0]} className="mt-12">
        <TabsList variant="line" className="w-full justify-start border-b">
          {tabs.includes("description") && (
            <TabsTrigger value="description" className="flex-none px-4">
              Description
            </TabsTrigger>
          )}
          <TabsTrigger value="specifications" className="flex-none px-4">
            Specifications
          </TabsTrigger>
          {tabs.includes("documents") && (
            <TabsTrigger value="documents" className="flex-none px-4">
              Documents ({details.documents.length})
            </TabsTrigger>
          )}
        </TabsList>
        {description && (
          <TabsContent value="description" className="max-w-3xl pt-6">
            {description}
          </TabsContent>
        )}
        <TabsContent value="specifications" className="pt-6">
          <table className="w-full max-w-3xl text-sm">
            <tbody>
              {specRows.map((row) => (
                <tr key={row.name} className="border-b last:border-b-0">
                  <th scope="row" className="w-1/3 py-2.5 pr-4 text-left font-normal text-muted-foreground">
                    {row.name}
                  </th>
                  <td className="py-2.5 font-medium">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
        {details.documents.length > 0 && (
          <TabsContent value="documents" className="pt-6">
            <ul className="flex max-w-3xl flex-col gap-2">
              {details.documents.map((document) => (
                <li key={document.id}>
                  <a href={document.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium hover:bg-muted">
                    <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    {document.name}
                  </a>
                </li>
              ))}
            </ul>
          </TabsContent>
        )}
      </Tabs>
    </>
  )
}
