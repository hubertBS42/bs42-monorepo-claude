"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cn } from "cn"
import { CheckIcon, MinusIcon } from "lucide-react"

type CheckboxProps = Omit<CheckboxPrimitive.Root.Props, "checked" | "indeterminate"> & {
  checked?: boolean | "indeterminate"
}

function Checkbox({ className, checked, ...props }: CheckboxProps) {
  const indeterminate = checked === "indeterminate"

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked === "indeterminate" ? false : checked}
      indeterminate={indeterminate}
      className={cn(
        "peer flex size-4 shrink-0 items-center justify-center rounded-lg border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-indeterminate:bg-primary data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="flex items-center justify-center text-current transition-none">
        {indeterminate ? <MinusIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
