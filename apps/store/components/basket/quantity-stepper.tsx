"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

// A quantity with − and + buttons, from 1 to max
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
  onChange: (next: number) => void
  disabled?: boolean
  label: string
  className?: string
}) {
  return (
    <div className={cn("inline-flex h-9 items-center rounded-lg border", className)} role="group" aria-label={label}>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label="One fewer">
        <Minus aria-hidden />
      </Button>
      <span className="w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="One more">
        <Plus aria-hidden />
      </Button>
    </div>
  )
}
