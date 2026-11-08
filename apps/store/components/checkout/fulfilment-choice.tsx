"use client"

import { MapPin, Truck } from "lucide-react"
import type { PickupLocationView, PickupOption } from "@workspace/commerce/pickup-locations"
import { cn } from "@workspace/ui/lib/utils"

// Delivery, or collection from one of the locations the basket can be collected from (pickupOptions)
export type Fulfilment = { method: "DELIVERY" } | { method: "PICKUP"; pickupLocationId: string }

// The last location chosen in this browser, offered first next time. Browser storage can be missing or refuse.
const REMEMBERED = "bs42-pickup-location"
export function rememberedLocation(options: PickupOption[]): string | null {
  try {
    const id = window.localStorage.getItem(REMEMBERED)
    return options.some((option) => option.id === id) ? id : null
  } catch {
    return null
  }
}
function remember(id: string) {
  try {
    window.localStorage.setItem(REMEMBERED, id)
  } catch {
    // Not remembered: nothing else depends on it
  }
}

// Large choices: delivery, then a "Collect from" per location; shown only when the basket can be collected somewhere
export function FulfilmentChoice({ value, onChange, options, disabled }: { value: Fulfilment; onChange: (value: Fulfilment) => void; options: PickupOption[]; disabled?: boolean }) {
  const choice = (key: string, selected: boolean, onSelect: () => void, title: string, detail: string, Icon: typeof Truck) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn("flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors", selected ? "border-primary bg-primary/5" : "hover:bg-muted/50")}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="grid gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{detail}</span>
      </span>
    </button>
  )
  return (
    <div role="radiogroup" aria-label="Delivery or collection" className="grid gap-3 sm:grid-cols-2">
      {choice("delivery", value.method === "DELIVERY", () => onChange({ method: "DELIVERY" }), "Delivery", "To your address", Truck)}
      {options.map((option) =>
        choice(
          option.id,
          value.method === "PICKUP" && value.pickupLocationId === option.id,
          () => {
            remember(option.id)
            onChange({ method: "PICKUP", pickupLocationId: option.id })
          },
          `Collect from ${option.name}`,
          "Free",
          MapPin
        )
      )}
    </div>
  )
}

// Where to collect it, under the choice
export function PickupAddress({ pickup }: { pickup: PickupLocationView }) {
  return (
    <div className="grid gap-0.5 rounded-lg bg-muted/50 p-3 text-sm">
      <p className="font-medium">{pickup.name}</p>
      <p className="whitespace-pre-line text-muted-foreground">{pickup.address}</p>
      {pickup.hours && <p className="whitespace-pre-line text-muted-foreground">{pickup.hours}</p>}
      {pickup.mapUrl && (
        <a href={pickup.mapUrl} target="_blank" rel="noopener noreferrer" className="w-fit underline underline-offset-4 hover:text-foreground">
          Get directions
        </a>
      )}
    </div>
  )
}
