"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Package, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { clearCompare, compareHref, removeComparePick, useComparePicks } from "@/components/compare/compare-state"
import { MAX_COMPARE } from "@/lib/compare"

// The products picked to compare, along the bottom of every page while there are any (not on the comparison itself).
// A spacer of the same height keeps it from covering the end of the page.
export function CompareBar() {
  const pathname = usePathname()
  const picks = useComparePicks()
  if (!picks.length || pathname === "/compare") return null

  const canCompare = picks.length >= 2

  return (
    <>
      <div className="h-20" aria-hidden />
      <section
        aria-label="Compare products"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 shadow-[0_-4px_12px_-6px_rgb(0_0_0/0.15)] backdrop-blur supports-backdrop-filter:bg-background/80"
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-3 px-4 lg:px-6">
          {/* On phones, only the count: there isn't room for the picks */}
          <p className="flex-1 text-sm font-medium sm:hidden">
            {picks.length} of {MAX_COMPARE} to compare
          </p>
          <ul className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
            {picks.map((pick) => (
              <li key={pick.id} className="relative flex max-w-56 min-w-0 items-center gap-2 rounded-lg border bg-card p-1.5 pr-8">
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted" title={pick.name}>
                  {pick.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
                    <img src={pick.image} alt="" className="size-full object-contain p-0.5" />
                  ) : (
                    <Package className="size-4 text-muted-foreground/40" aria-hidden />
                  )}
                </div>
                <span className="line-clamp-2 text-xs leading-snug font-medium">{pick.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1/2 right-1.5 -translate-y-1/2"
                  onClick={() => removeComparePick(pick.id)}
                  aria-label={`Remove ${pick.name} from the comparison`}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
            <li className="hidden text-xs text-muted-foreground lg:block">
              {picks.length} of {MAX_COMPARE}
            </li>
          </ul>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={clearCompare}>
              Clear
            </Button>
            {canCompare ? (
              <Button render={<Link href={compareHref(picks.map((pick) => pick.id))} />}>Compare ({picks.length})</Button>
            ) : (
              <Button disabled title="Pick another product to compare">
                Compare (1)
              </Button>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
