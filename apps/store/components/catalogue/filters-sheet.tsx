"use client"

import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet"

// The filters on small screens. Following a filter link closes the sheet, so the results show.
export function FiltersSheet({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="lg:hidden" />}>
        <SlidersHorizontal />
        Filters{activeCount > 0 && ` (${activeCount})`}
      </SheetTrigger>
      <SheetContent side="left" className="w-[85%] gap-0 overflow-y-auto">
        <SheetHeader className="border-b">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div
          className="p-4"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false)
          }}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
