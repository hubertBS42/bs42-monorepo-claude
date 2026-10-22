"use client"

import { Printer } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

// The browser's print dialog, which also saves as PDF
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer data-icon="inline-start" aria-hidden />
      Print or save as PDF
    </Button>
  )
}
