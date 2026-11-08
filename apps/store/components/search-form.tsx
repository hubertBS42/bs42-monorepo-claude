import Form from "next/form"
import { Search } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

export const searchInputClass = "h-11 rounded-full border-transparent bg-muted pl-10 shadow-none focus-visible:bg-background"

// Searches by name, SKU or barcode on /search
export function SearchForm({ defaultValue, className }: { defaultValue?: string; className?: string }) {
  return (
    <Form action="/search" role="search" className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search products, SKUs or barcodes"
        aria-label="Search products"
        className={searchInputClass}
      />
    </Form>
  )
}
