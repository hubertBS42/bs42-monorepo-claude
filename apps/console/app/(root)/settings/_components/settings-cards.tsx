"use client"

import { useRef } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { PLATFORM_ALERTS, type AppSettingsData } from "@workspace/contracts"
import { ImageField, NumberInputField, SwitchField, TagsField, TextareaField, TextInputField } from "@workspace/forms"
import type { SectionInput, SectionOutput } from "@/lib/schemas/app-settings.schemas"
import { deleteImages, uploadImages } from "@/lib/storage"
import SettingsCard from "./settings-card"

// The cards of the settings pages, each saving its own fields (settings-card.tsx)

type CardProps = { settings: AppSettingsData }

export function StorefrontCard({ settings }: CardProps) {
  return (
    <SettingsCard section="storefront" settings={settings} title="Storefront" description="The name and description customers see in the store and in search results.">
      {(form, isPending) => (
        <>
          <TextInputField control={form.control} name="storeName" label="Name" disabled={isPending} />
          <TextareaField control={form.control} name="storeDescription" label="Description" placeholder="A short description" showCount maxLength={160} disabled={isPending} />
        </>
      )}
    </SettingsCard>
  )
}

export function ConsoleCard({ settings }: CardProps) {
  return (
    <SettingsCard section="console" settings={settings} title="Console" description="The name staff see in the console and in invitation emails.">
      {(form, isPending) => (
        <>
          <TextInputField control={form.control} name="consoleName" label="Name" placeholder="Leave empty to use the storefront name" disabled={isPending} />
          <TextareaField control={form.control} name="consoleDescription" label="Description" placeholder="A short description" showCount maxLength={160} disabled={isPending} />
        </>
      )}
    </SettingsCard>
  )
}

export function BrandingCard({ settings }: CardProps) {
  // Files the live site uses right now. They're never deleted from the browser: the server removes them after a save
  // that replaces them. Uploads that are never saved are left to the orphaned-file sweep.
  const saved = [settings.logoUrl, settings.faviconUrl]
  // Uploaded during this visit and not saved yet, so removing one in the form deletes it
  const unsaved = useRef<string[]>([])

  const handleAdd = async (files: FileList) => {
    const formData = new FormData()
    Array.from(files).forEach((file) => formData.append("files", file))
    const urls = await uploadImages(formData)
    unsaved.current.push(...urls)
    return urls
  }

  const handleRemove = async (url: string) => {
    if (saved.includes(url) || !unsaved.current.includes(url)) return
    await deleteImages([url])
    unsaved.current = unsaved.current.filter((item) => item !== url)
  }

  return (
    <SettingsCard section="branding" settings={settings} title="Branding" description="Shared by the storefront, the console and emails." onSaved={() => (unsaved.current = [])}>
      {(form, isPending) => (
        <>
          <ImageField
            control={form.control}
            name="logoUrl"
            sizeLimit={100}
            maxImages={1}
            onAdd={handleAdd}
            onRemove={handleRemove}
            clearErrors={form.clearErrors}
            label="Logo"
            disabled={isPending}
            orientation="horizontal"
          />
          <ImageField
            control={form.control}
            name="faviconUrl"
            label="Favicon"
            description="Square PNG, at least 256×256px, up to 100 KB"
            accept="image/png"
            square
            minDimension={256}
            sizeLimit={100}
            maxImages={1}
            onAdd={handleAdd}
            onRemove={handleRemove}
            clearErrors={form.clearErrors}
            disabled={isPending}
            orientation="horizontal"
          />
        </>
      )}
    </SettingsCard>
  )
}

export function TaxCard({ settings }: CardProps) {
  return (
    <SettingsCard section="tax" settings={settings} title="Tax" description="Prices are shown without tax. When tax is on, it is added at checkout and each order keeps the rate it was charged.">
      {(form, isPending) => <TaxFields form={form} isPending={isPending} />}
    </SettingsCard>
  )
}

// Its own component so it can watch the switch
function TaxFields({ form, isPending }: { form: UseFormReturn<SectionInput<"tax">, unknown, SectionOutput<"tax">>; isPending: boolean }) {
  const taxEnabled = useWatch({ control: form.control, name: "taxEnabled" })
  return (
    <>
      <div className="flex flex-col gap-3">
        <SwitchField control={form.control} name="taxEnabled" label="Charge tax" description="Add tax to every order" variant="card" disabled={isPending} />
        <SwitchField control={form.control} name="taxShipping" label="Tax delivery fees" description="Charge tax on the delivery fee too" variant="card" disabled={isPending || !taxEnabled} />
      </div>
      <NumberInputField control={form.control} name="taxRatePercent" label="Tax rate (%)" min={0} max={100} step={0.01} disabled={isPending || !taxEnabled} />
    </>
  )
}

export function MarkupCard({ settings }: CardProps) {
  return (
    <SettingsCard
      section="markup"
      settings={settings}
      title="Exchange Rate Markup"
      description="Added to the rate fetched each day, to cover the cedi weakening between pricing and payment (quotations hold their prices for days). A rate set by hand above is used as typed. 0 adds nothing."
    >
      {(form, isPending) => <NumberInputField control={form.control} name="exchangeRateMarkupPercent" label="Markup (%)" min={0} max={10} step={0.01} disabled={isPending} />}
    </SettingsCard>
  )
}

export function QuotationsCard({ settings }: CardProps) {
  return (
    <SettingsCard
      section="quotations"
      settings={settings}
      title="Quotations"
      description="How long a quotation's prices hold, whatever the exchange rate does; its stock isn't held. Staff can choose another length on a quotation they make."
    >
      {(form, isPending) => <NumberInputField control={form.control} name="quoteValidityDays" label="Valid for (days)" min={1} max={90} step={1} disabled={isPending} />}
    </SettingsCard>
  )
}

export function BankTransferCard({ settings }: CardProps) {
  return (
    <SettingsCard
      section="bankTransfer"
      settings={settings}
      title="Bank Transfer"
      description="Where customers send a bank transfer for an order staff made. Shown, as typed, on its confirmation email, order page and invoice until it's paid."
    >
      {(form, isPending) => (
        <TextareaField
          control={form.control}
          name="bankTransferDetails"
          label="Bank details"
          placeholder={"Bank name\nAccount name\nAccount number\nBranch"}
          rows={5}
          maxLength={1000}
          showCount
          disabled={isPending}
        />
      )}
    </SettingsCard>
  )
}

// The same alerts and words as each admin's own switches for their bell (Account → Notifications)
const NOTIFICATION_SWITCHES = PLATFORM_ALERTS.map(({ settingsKey, label, description }) => ({ name: settingsKey, label, description }))

export function NotificationsCard({ settings }: CardProps) {
  return (
    <SettingsCard
      section="notifications"
      settings={settings}
      title="Notifications"
      description="When something needs attention: emails to these addresses, for the events switched on below. Each platform admin chooses what reaches their own bell in Account → Notifications."
    >
      {(form, isPending) => (
        <>
          <TagsField
            control={form.control}
            name="notificationEmails"
            label="Send to"
            description="Press Enter or a comma after each address. Up to 10."
            placeholder="orders@example.com"
            maxTags={10}
            disabled={isPending}
          />
          <div className="flex flex-col gap-3">
            {NOTIFICATION_SWITCHES.map((item) => (
              <SwitchField key={item.name} control={form.control} name={item.name} label={item.label} description={item.description} variant="card" disabled={isPending} />
            ))}
          </div>
        </>
      )}
    </SettingsCard>
  )
}
