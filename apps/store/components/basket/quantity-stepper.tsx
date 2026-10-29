"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

// A quantity with − and + buttons, from 1 to max. The number can also be typed: it applies on Enter or when the box
// loses focus (not per keystroke), clamped to 1..max; anything else puts it back. onChange's typed is true for a typed
// number, which the basket saves at once rather than waiting for more clicks.
export function QuantityStepper({
  value,
  max,
  onChange,
  disabled,
  label,
  className,
}: {
  value: number
  max: number
  onChange: (next: number, typed?: boolean) => void
  disabled?: boolean
  label: string
  className?: string
}) {
  // What's being typed, null while the box shows the value
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft === null) return
    setDraft(null)
    const typed = Number.parseInt(draft, 10)
    if (!Number.isFinite(typed) || typed < 1) return
    const next = Math.min(typed, max)
    if (next !== value) onChange(next, true)
  }

  return (
    <div className={cn("inline-flex h-9 items-center rounded-lg border", className)} role="group" aria-label={label}>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label="One fewer">
        <Minus aria-hidden />
      </Button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, String(max).length))}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          } else if (e.key === "Escape") {
            setDraft(null)
          }
        }}
        disabled={disabled}
        aria-label="Quantity"
        className="h-full w-10 bg-transparent text-center text-sm font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
      />
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="One more">
        <Plus aria-hidden />
      </Button>
    </div>
  )
}
