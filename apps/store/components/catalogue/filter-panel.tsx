import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { hrefWith, type CatalogueQuery, type Facets, type SearchParams } from "@/lib/catalogue-filters"

// A tick box that's a link: the filters work without JavaScript, and every state has its own URL
function FilterLink({ href, selected, label, count }: { href: string; selected: boolean; label: string; count: number }) {
  const disabled = count === 0 && !selected
  return (
    <Link
      href={href}
      scroll={false}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={cn("flex items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-muted", disabled && "pointer-events-none opacity-50")}
    >
      <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-sm border border-input", selected && "border-primary bg-primary text-primary-foreground")}>
        {selected && <Check className="size-3" />}
      </span>
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </Link>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b py-4 first:pt-0 last:border-b-0">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

export function FilterPanel({ pathname, params, query, facets }: { pathname: string; params: SearchParams; query: CatalogueQuery; facets: Facets }) {
  // The price form sends the other filters along with the amounts
  const kept = Object.entries(params).flatMap(([key, value]) => (["min", "max", "page"].includes(key) ? [] : (Array.isArray(value) ? value : value ? [value] : []).map((item) => [key, item] as const)))

  return (
    <div>
      <FilterSection title="Availability">
        <FilterLink href={hrefWith(pathname, params, { set: { stock: query.inStock ? null : "in" } })} selected={query.inStock} label="In stock" count={facets.inStockCount} />
      </FilterSection>

      {facets.hasPrices && (
        <FilterSection title="Price (GH₵)">
          <form action={pathname} className="flex items-center gap-2">
            {kept.map(([key, value], index) => (
              <input key={`${key}-${index}`} type="hidden" name={key} value={value} />
            ))}
            <Input name="min" inputMode="decimal" placeholder="Min" defaultValue={query.min?.toString()} aria-label="Lowest price" className="h-8" />
            <span className="text-muted-foreground">–</span>
            <Input name="max" inputMode="decimal" placeholder="Max" defaultValue={query.max?.toString()} aria-label="Highest price" className="h-8" />
            <Button type="submit" size="sm" variant="outline">
              Go
            </Button>
          </form>
        </FilterSection>
      )}

      {facets.lists.map((facet) => (
        <FilterSection key={facet.param} title={facet.name}>
          <div className="flex max-h-72 flex-col overflow-y-auto">
            {facet.values.map((value) => (
              <FilterLink key={value.key} href={hrefWith(pathname, params, { toggle: [facet.param, value.key] })} selected={value.selected} label={value.label} count={value.count} />
            ))}
          </div>
        </FilterSection>
      ))}
    </div>
  )
}
