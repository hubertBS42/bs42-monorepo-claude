"use client"

import { MapPin, Truck } from "lucide-react"
import type { PickupLocationView } from "@workspace/commerce/pickup-locations"
import { cn } from "@workspace/ui/lib/utils"

// Delivery, or collection from the store's pickup location, as two large choices; shown only when collection is possible
export function FulfilmentChoice({
  value,
  onChange,
  pickup,
  disabled,
}: {
  value: "DELIVERY" | "PICKUP"
  onChange: (value: "DELIVERY" | "PICKUP") => void
  pickup: PickupLocationView
  disabled?: boolean
}) {
  const option = (choice: "DELIVERY" | "PICKUP", title: string, detail: string, Icon: typeof Truck) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === choice}
      disabled={disabled}
      onClick={() => onChange(choice)}
      className={cn("flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors", value === choice ? "border-primary bg-primary/5" : "hover:bg-muted/50")}
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
      {option("DELIVERY", "Delivery", "To your address", Truck)}
      {option("PICKUP", `Collect from ${pickup.name}`, "Free", MapPin)}
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
