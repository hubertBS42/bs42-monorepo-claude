"use client"

import { useEffect, useRef, useState } from "react"
import { Check } from "lucide-react"
import { PAYMENT_METHOD_LABELS } from "@workspace/commerce/order-status"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { STAFF_ORDER_PAYMENT_METHODS } from "@/lib/schemas/order.schemas"

// Below this the three labels touch their edges, so they stack
const MIN_ROW_WIDTH = 400

export type StaffPaymentMethod = (typeof STAFF_ORDER_PAYMENT_METHODS)[number]

// How a customer at the counter paid: a choice of one, not styled as buttons, so the card's own button stays its only
// action. The chosen one is tinted and ticked, which the toggle's plain grey didn't show well enough. Pressing it again
// keeps it, so there's always a method.
export function PaymentMethodToggle({
  value,
  onValueChange,
  orientation = "horizontal",
}: {
  value: StaffPaymentMethod
  onValueChange: (method: StaffPaymentMethod) => void
  orientation?: "horizontal" | "vertical"
}) {
  // By its own width, not the screen's: Counter Sale's card is as narrow on a small laptop as on a phone
  const box = useRef<HTMLDivElement>(null)
  const [tooNarrow, setTooNarrow] = useState(false)
  useEffect(() => {
    if (!box.current) return
    const observer = new ResizeObserver(([entry]) => setTooNarrow(!!entry && entry.contentRect.width < MIN_ROW_WIDTH))
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [])
  const direction = tooNarrow ? "vertical" : orientation
  return (
    <div ref={box}>
      <ToggleGroup
        multiple={false}
        value={[value]}
        onValueChange={(values) => {
          const chosen = STAFF_ORDER_PAYMENT_METHODS.find((method) => method === values[0])
          if (chosen) onValueChange(chosen)
        }}
        variant="outline"
        spacing={0}
        orientation={direction}
        aria-label="Paid by"
        className={direction === "horizontal" ? "w-full *:flex-1" : "w-full"}
      >
        {STAFF_ORDER_PAYMENT_METHODS.map((method) => (
          <ToggleGroupItem
            key={method}
            value={method}
            // An inset ring, since the joined items share their borders
            className="aria-pressed:bg-primary/10 aria-pressed:font-semibold aria-pressed:text-primary aria-pressed:ring-1 aria-pressed:ring-primary aria-pressed:ring-inset aria-pressed:hover:bg-primary/15"
          >
            {method === value && <Check data-icon="inline-start" />}
            {PAYMENT_METHOD_LABELS[method]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
