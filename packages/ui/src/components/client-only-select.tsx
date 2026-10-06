"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "cn"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

export interface ClientOnlySelectOption {
  label: string
  value: string
}

interface ClientOnlySelectProps {
  id?: string
  value?: string
  onValueChange?: (value: string) => void
  options: ClientOnlySelectOption[]
  placeholder?: string
  loadingPlaceholder: string
  size?: "sm" | "default"
  side?: "top" | "bottom" | "left" | "right"
  disabled?: boolean
  className?: string
}

/**
 * A `Select` that only renders its interactive Base UI markup after mount.
 * Useful when the initial `value` is derived from something that can differ
 * between the server render and the client (e.g. URL search params), which
 * would otherwise trigger a hydration mismatch.
 */
const ClientOnlySelect = ({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  loadingPlaceholder,
  size = "default",
  side,
  disabled,
  className,
}: ClientOnlySelectProps) => {
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div
        id={id}
        data-size={size}
        className={cn(
          "flex w-fit items-center justify-between gap-1.5 rounded-md border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap shadow-xs data-[size=default]:h-9 data-[size=sm]:h-8 dark:bg-input/30",
          className
        )}
      >
        <span className="text-muted-foreground">{loadingPlaceholder}</span>
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
      </div>
    )
  }

  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next: string | null) => onValueChange?.(next ?? "")}
      disabled={disabled}
    >
      <SelectTrigger id={id} size={size} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent side={side}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default ClientOnlySelect
