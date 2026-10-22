"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Info, Lock, Package } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import ComboboxField from "@workspace/forms/components/combobox-field"
import PhoneField from "@workspace/forms/components/phone-field"
import SwitchField from "@workspace/forms/components/switch-field"
import TextInputField from "@workspace/forms/components/text-input-field"
import TextareaField from "@workspace/forms/components/textarea-field"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { LegalConsent, type LegalLinks } from "@/components/legal-consent"
import { placeOrderAction, quoteCheckoutAction } from "@/lib/actions/checkout.actions"
import type { CartLine } from "@/lib/cart"
import type { CheckoutSummary } from "@/lib/checkout"
import { formatGhs } from "@/lib/money"
import { checkoutFormSchema, type CheckoutFormValues } from "@/lib/schemas/checkout.schemas"

// Codes that mean the basket or its prices changed under the page: it reloads to show them
const REFRESH_ON = ["BASKET_CHANGED", "PRICE_CHANGED"]

export interface DeliveryArea {
  region: string
  towns: string[]
}

// A signed-in customer's details, filled in for them
export interface CheckoutAccount {
  name: string
  email: string
  phone: string
}

// A saved address; one in a town without delivery can't be chosen
export interface SavedAddressOption {
  id: string
  name: string
  phone: string
  line1: string
  line2: string
  region: string
  town: string
  isDefault: boolean
  deliverable: boolean
}

const NEW_ADDRESS = "new"

const addressLabel = (address: SavedAddressOption) => `${address.line1}, ${address.town}${address.deliverable ? "" : " (we don't deliver there yet)"}`

// The form's starting values: the account's details, and its default address when it can be delivered to
function startingValues(account: CheckoutAccount | null, savedCount: number, start: SavedAddressOption | undefined): CheckoutFormValues {
  const blank = { name: account?.name ?? "", email: account?.email ?? "", phone: account?.phone ?? "", line1: "", line2: "", region: "", town: "", notes: "" }
  // Kept for next time by default when the account has no address of its own yet
  const saveAddress = !!account && savedCount === 0
  if (!start) return { ...blank, saveAddress }
  return { ...blank, name: start.name, phone: start.phone, line1: start.line1, line2: start.line2, region: start.region, town: start.town, saveAddress }
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={muted ? "flex justify-between gap-4 text-muted-foreground" : "flex justify-between gap-4"}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export function CheckoutForm({
  lines,
  areas,
  initialSummary,
  paymentMinutes,
  account,
  savedAddresses,
  legal,
  installationAreas,
}: {
  lines: CartLine[]
  areas: DeliveryArea[]
  // Where installers work ("Greater Accra and Adum"), when a line includes installation
  installationAreas: string | null
  initialSummary: CheckoutSummary
  account: CheckoutAccount | null
  savedAddresses: SavedAddressOption[]
  // Which of the Terms and Privacy pages exist, for the line under the button
  legal: LegalLinks
  // How long the order holds its items for the customer to pay
  paymentMinutes: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isQuoting, startQuote] = useTransition()
  const [summary, setSummary] = useState(initialSummary)
  const [areaError, setAreaError] = useState<string | null>(null)

  const startAddress = savedAddresses.find((address) => address.isDefault && address.deliverable)
  const [addressChoice, setAddressChoice] = useState(startAddress?.id ?? NEW_ADDRESS)
  const form = useForm<CheckoutFormValues>({ resolver: zodResolver(checkoutFormSchema), defaultValues: startingValues(account, savedAddresses.length, startAddress) })

  // Choosing a saved address fills the delivery in from it; "A new address" empties it for typing
  const chooseAddress = (choice: string) => {
    setAddressChoice(choice)
    const saved = savedAddresses.find((address) => address.id === choice)
    const values = saved
      ? { name: saved.name, phone: saved.phone, line1: saved.line1, line2: saved.line2, region: saved.region, town: saved.town }
      : { name: account?.name ?? "", phone: account?.phone ?? "", line1: "", line2: "", region: "", town: "" }
    for (const [key, value] of Object.entries(values)) form.setValue(key as keyof typeof values, value, { shouldDirty: true })
    form.clearErrors()
  }
  const addressOptions = useMemo(
    () => [...savedAddresses.map((address) => ({ value: address.id, label: addressLabel(address), disabled: !address.deliverable })), { value: NEW_ADDRESS, label: "A new address", disabled: false }],
    [savedAddresses]
  )

  const region = useWatch({ control: form.control, name: "region" })
  const town = useWatch({ control: form.control, name: "town" })
  const regionOptions = useMemo(() => areas.map((area) => ({ label: area.region, value: area.region })), [areas])
  const townOptions = useMemo(() => (areas.find((area) => area.region === region)?.towns ?? []).map((name) => ({ label: name, value: name })), [areas, region])

  // The delivery fee, and so the total, follow the town. Only the answer for the town chosen last counts: an earlier
  // quote can answer after a later one.
  const [quotedFor, setQuotedFor] = useState<string | null>(null)
  const areaKey = region && town ? `${region}|${town}` : null
  // The town chosen now, read when a quote answers
  const isCurrentArea = useCallback(
    (key: string) => {
      const { region: currentRegion, town: currentTown } = form.getValues()
      return `${currentRegion}|${currentTown}` === key
    },
    [form]
  )

  const quote = useCallback(
    (key: string) =>
      startQuote(async () => {
        const [quoteRegion, quoteTown] = key.split("|") as [string, string]
        let result = await quoteCheckoutAction({ region: quoteRegion, town: quoteTown })
        if (!isCurrentArea(key)) return

        if (!result.success && result.code === "BASKET_CHANGED") {
          // Saved as it is now, so the reloaded page shows it, and pricing it again gives the real total
          toast.add({ title: "Your basket has changed", description: result.error, type: "warning" })
          router.refresh()
          result = await quoteCheckoutAction({ region: quoteRegion, town: quoteTown })
          if (!isCurrentArea(key)) return
        }

        if (result.success) {
          setSummary(result.data)
          setAreaError(null)
          setQuotedFor(key)
        } else {
          setAreaError(result.error)
          setQuotedFor(null)
          if (result.code === "EMPTY_BASKET") router.push("/basket")
        }
      }),
    [isCurrentArea, router]
  )

  useEffect(() => {
    if (areaKey) quote(areaKey)
  }, [areaKey, quote])
  const quoted = !!areaKey && quotedFor === areaKey && summary.deliveryGhs !== null

  const onSubmit = (values: CheckoutFormValues) =>
    startTransition(async () => {
      // The switch shows only for a new address
      const saveAddress = addressChoice === NEW_ADDRESS && !!values.saveAddress
      const result = await placeOrderAction({ ...values, saveAddress, expectedTotalGhs: summary.totalGhs })
      if (!result.success) {
        toast.add({ title: "Your order wasn't placed", description: result.error, type: "error" })
        if (result.code === "EMPTY_BASKET") router.push("/basket")
        else if (result.code && REFRESH_ON.includes(result.code)) {
          // Show the basket as it is now, priced again for this town
          setQuotedFor(null)
          router.refresh()
          if (areaKey) quote(areaKey)
        }
        return
      }
      // Paystack's checkout, or the order's page if Paystack couldn't be reached
      window.location.assign(result.data.redirectTo)
    })

  const busy = isPending || isQuoting
  const noDelivery = areas.length === 0

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start" noValidate>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            <CardDescription>We'll send your order confirmation to this email, and call this number about the delivery.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextInputField control={form.control} name="name" label="Full name" autoComplete="name" disabled={isPending} />
            </div>
            <TextInputField control={form.control} name="email" label="Email" type="email" autoComplete="email" disabled={isPending} />
            <PhoneField control={form.control} name="phone" label="Phone" defaultCountry="GH" disabled={isPending} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery address</CardTitle>
            <CardDescription>
              We deliver to the towns listed. The fee depends on the town.
              {installationAreas && ` We install in ${installationAreas}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {noDelivery ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">We're not taking deliveries yet. Please check back soon.</p>
            ) : (
              <>
                {savedAddresses.length > 0 && (
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="saved-address">Deliver to</FieldLabel>
                    <Select items={addressOptions} value={addressChoice} onValueChange={(next) => next && chooseAddress(next)} disabled={isPending}>
                      <SelectTrigger id="saved-address" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {addressOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <div className="sm:col-span-2">
                  <TextInputField control={form.control} name="line1" label="Address" placeholder="House number and street, or a landmark" autoComplete="address-line1" disabled={isPending} />
                </div>
                <div className="sm:col-span-2">
                  <TextInputField
                    control={form.control}
                    name="line2"
                    label="More details (optional)"
                    placeholder="Area, digital address (GhanaPost GPS), directions"
                    autoComplete="address-line2"
                    disabled={isPending}
                  />
                </div>
                <ComboboxField
                  control={form.control}
                  name="region"
                  label="Region"
                  options={regionOptions}
                  placeholder="Select a region"
                  disabled={isPending}
                  onValueChange={(next) => {
                    if (next !== region) form.setValue("town", "")
                  }}
                />
                <ComboboxField control={form.control} name="town" label="Town" options={townOptions} placeholder="Select a town" disabled={isPending || !region} />
                {areaError && <p className="text-sm text-destructive sm:col-span-2">{areaError}</p>}
                {account && addressChoice === NEW_ADDRESS && (
                  <div className="sm:col-span-2">
                    <SwitchField control={form.control} name="saveAddress" label="Save this address to my account" description="Checkout can fill it in next time." disabled={isPending} />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <TextareaField control={form.control} name="notes" label="Anything we should know? (optional)" rows={3} disabled={isPending} />
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-36">
        <CardHeader>
          <CardTitle>Your order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="space-y-3">
            {lines.map((line) => (
              <li key={line.id} className="flex gap-3">
                <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {line.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
                    <img src={line.image} alt="" className="size-full object-contain p-1" />
                  ) : (
                    <Package className="size-5 text-muted-foreground/40" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-medium">{line.productName}</p>
                  <p className="text-muted-foreground">
                    {line.variantDescription && `${line.variantDescription} · `}Qty {line.quantity}
                  </p>
                  {line.installationGhs && <p className="text-muted-foreground">With installation, {formatGhs(line.installationGhs)}</p>}
                </div>
                {line.totalGhs && <span className="font-medium tabular-nums">{formatGhs(line.totalGhs)}</span>}
              </li>
            ))}
          </ul>
          <Separator />
          <div className="space-y-2">
            <SummaryRow label="Items" value={formatGhs(summary.itemsGhs)} />
            {summary.installationGhs && <SummaryRow label="Installation" value={formatGhs(summary.installationGhs)} />}
            <SummaryRow label="Delivery" value={!quoted ? "Choose your town" : summary.freeDelivery ? "Free" : formatGhs(summary.deliveryGhs!)} muted={!quoted} />
            {summary.taxGhs && <SummaryRow label="Includes tax" value={formatGhs(summary.taxGhs)} muted />}
          </div>
          <Separator />
          <div className="flex items-baseline justify-between gap-4 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{quoted ? formatGhs(summary.totalGhs) : "—"}</span>
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button type="submit" size="lg" disabled={busy || !quoted || noDelivery}>
            {isPending ? <Spinner data-icon="inline-start" /> : <Lock data-icon="inline-start" aria-hidden />}
            {quoted ? `Pay ${formatGhs(summary.totalGhs)}` : "Pay"}
          </Button>
          <p className="flex gap-2 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0" aria-hidden />
            You'll pay by mobile money or card on Paystack's secure page. We hold your items for {paymentMinutes} minutes while you pay.
          </p>
          <LegalConsent action="placing your order" links={legal} />
        </CardFooter>
      </Card>
    </form>
  )
}
