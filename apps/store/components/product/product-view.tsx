"use client"

import { useState } from "react"
import Link from "next/link"
import { Building2, FileText, MessageCircle, Package, ShieldCheck, Truck, Wrench } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

import { AddToBasketButton } from "@/components/basket/add-to-basket"
import { QuantityStepper } from "@/components/basket/quantity-stepper"
import { MAX_LINE_QUANTITY, TRADE_LINE_QUANTITY } from "@/lib/basket-limits"
import { useTradePercent } from "@/components/trade/trade-state"
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

// Settings' phone and WhatsApp, for questions about the product; `phoneLabel` is the phone formatted for reading
export type ProductContact = { phone: string | null; phoneLabel: string | null; whatsapp: string | null }

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [current, setCurrent] = useState(0)
  const image = images[current]

  return (
    <div className="flex flex-col gap-3">
      {/* White behind a photo, as on the cards (product-card.tsx) */}
      <div className={cn("flex aspect-square items-center justify-center overflow-hidden rounded-xl", image ? "bg-white" : "bg-muted")}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
          <img src={image} alt={name} className="size-full object-contain" />
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
                className={cn("flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-white", index === current && "ring-2 ring-ring")}
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
  summary,
  contact,
}: {
  card: PricedCard
  details: ProductDetails
  initialVariantId: string | null
  // Rendered on the server (RichTextContent)
  description: React.ReactNode
  freeDeliveryFromGhs: string | null
  // Installing one unit (with tax when it's on) and where installers work; null when it isn't offered
  installation: { unitGhs: string; areas: string } | null
  // The description's opening lines (summaryLines), `more` when it goes on
  summary: { lines: string[]; more: boolean } | null
  contact: ProductContact
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
  // The basket caps it at what the store has; this only stops the stepper going past a low stock count shown. A trade
  // account's lines hold more.
  const maxLine = useTradePercent() === null ? MAX_LINE_QUANTITY : TRADE_LINE_QUANTITY
  const maxQuantity = offer.stock.kind === "in-stock" ? Math.min(offer.stock.left ?? maxLine, maxLine) : 1

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
            <h1 className="text-2xl font-bold tracking-tight normal-case md:text-3xl">{card.name}</h1>
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

          {/* Wide screens only: on a phone the description is just below, and there's no empty column to fill */}
          {summary && (
            <div className="hidden space-y-1.5 text-sm lg:block">
              <h2 className="font-semibold">Overview</h2>
              <ul className="space-y-0.5 leading-relaxed text-muted-foreground">
                {summary.lines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
              {summary.more && tabs[0] === "description" && (
                <a href="#details" className="inline-block font-medium underline-offset-4 hover:underline">
                  Read more
                </a>
              )}
            </div>
          )}

          <ul className="divide-y rounded-xl border text-sm">
            <ServiceRow icon={Truck} title="Delivery across Ghana">
              The fee depends on where you are and is added at checkout.
              {freeDeliveryFromGhs && ` Free on orders of ${formatGhs(freeDeliveryFromGhs)} or more.`}
            </ServiceRow>
            <ServiceRow icon={ShieldCheck} title="Secure payment">
              Mobile Money or card, through Paystack.
            </ServiceRow>
            {(contact.phone || contact.whatsapp) && (
              <ServiceRow icon={MessageCircle} title="Questions about this product?">
                {contact.phone && (
                  <>
                    Call{" "}
                    <a href={`tel:${contact.phone}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                      {contact.phoneLabel}
                    </a>
                    {contact.whatsapp ? " or " : "."}
                  </>
                )}
                {contact.whatsapp && (
                  <a
                    // wa.me takes the international number as digits only, and starts the chat with the product's name
                    href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I have a question about ${label}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {contact.phone ? "message us on WhatsApp" : "Message us on WhatsApp"}
                  </a>
                )}
                {contact.whatsapp && "."}
              </ServiceRow>
            )}
            <ServiceRow icon={Building2} title="Buying for a business?">
              <Link href="/trade" className="font-medium text-foreground underline-offset-4 hover:underline">
                Open a trade account
              </Link>{" "}
              for business pricing.
            </ServiceRow>
          </ul>
        </div>
      </div>

      {/* "Read more" in the overview lands here */}
      <Tabs id="details" defaultValue={tabs[0]} className="mt-12 scroll-mt-28">
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

// A row of the buy box's help card: delivery, payment, questions, trade
function ServiceRow({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 p-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-(family-name:--font-display) font-bold uppercase">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </li>
  )
}
