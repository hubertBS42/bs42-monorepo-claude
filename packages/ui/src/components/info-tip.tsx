"use client"

import * as React from "react"
import { InfoIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"

// An ⓘ beside a label or title that opens more detail: on hover with a mouse, and on tap or with the keyboard,
// since hover-only tooltips don't work on touch screens. For how something works, not for anything someone must
// see before acting: keep warnings in the visible description.
function InfoTip({
  about,
  children,
  className,
}: {
  // What it's about, for screen readers: "More about Markup"
  about: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        aria-label={`More about ${about}`}
        className={cn(
          "inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:text-foreground",
          className
        )}
      >
        <InfoIcon className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-64 gap-2 p-3 text-xs leading-relaxed text-muted-foreground"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

export { InfoTip }
