"use client"

import Form from "next/form"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { Package, Search } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import { OfferPrice } from "@/components/offer-details"
import { searchInputClass } from "@/components/search-form"
import { MAX_SEARCH_LENGTH, MIN_SEARCH_LENGTH, type SearchSuggestions } from "@/lib/search-suggestions"

const TYPING_PAUSE_MS = 200

// The header's search: suggestions as you type, each a link to its product. Enter still goes to /search for the whole
// list, and so does the form without JavaScript.
export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchSuggestions | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const term = query.trim().slice(0, MAX_SEARCH_LENGTH)
  const canSearch = term.length >= MIN_SEARCH_LENGTH

  useEffect(() => {
    if (!canSearch) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        if (!response.ok) return
        setResults(await response.json())
        setActive(-1)
      } catch {
        // Stale or failed: the form still searches on Enter
      }
    }, TYPING_PAUSE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [term, canSearch])

  const items = results?.items ?? []
  const isShown = isOpen && canSearch && results !== null
  const optionId = (index: number) => `${listId}-${index}`

  const reset = () => {
    setIsOpen(false)
    setActive(-1)
    setQuery("")
    setResults(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isShown) return
    if (event.key === "Escape") {
      // Or the browser also clears the box
      event.preventDefault()
      setIsOpen(false)
      setActive(-1)
    } else if (items.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      setActive((current) => (current === -1 && step === -1 ? items.length - 1 : (current + step + items.length) % items.length))
    } else if (event.key === "Enter" && items[active]) {
      event.preventDefault()
      router.push(`/p/${items[active].slug}`)
      reset()
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative w-full", className)}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) setIsOpen(false)
      }}
    >
      <Form action="/search" role="search" className="relative w-full" onSubmit={() => setIsOpen(false)}>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search products, SKUs or barcodes"
          aria-label="Search products"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isShown}
          aria-controls={listId}
          aria-activedescendant={isShown && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          className={searchInputClass}
        />
      </Form>

      <p role="status" className="sr-only">
        {isShown ? (results.total ? `${results.total} ${results.total === 1 ? "result" : "results"}` : "No results") : ""}
      </p>

      {isShown && (
        // Keeps the focus in the box while a suggestion is clicked, so the list isn't closed first
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg" onMouseDown={(event) => event.preventDefault()}>
          {items.length ? (
            <>
              <ul id={listId} role="listbox" aria-label="Search suggestions" className="max-h-[60vh] overflow-y-auto overscroll-contain p-1.5">
                {items.map((item, index) => (
                  <li key={item.id} id={optionId(index)} role="option" aria-selected={index === active}>
                    <Link href={`/p/${item.slug}`} tabIndex={-1} onClick={reset} onMouseEnter={() => setActive(index)} className={cn("flex items-center gap-3 rounded-lg p-2", index === active && "bg-accent text-accent-foreground")}>
                      <span className={cn("flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border", item.image ? "bg-white" : "bg-muted")}>
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- our own blob storage, not set up for next/image
                          <img src={item.image} alt="" className="size-full object-contain p-1" />
                        ) : (
                          <Package className="size-5 text-muted-foreground/60" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm leading-snug font-medium">{item.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.brandName}</span>
                      </span>
                      {/* On phones an old price goes under the price, so the name keeps its room */}
                      <span className="shrink-0 text-right max-sm:max-w-32 [&_p]:justify-end">
                        <OfferPrice offer={item.offer} size="xs" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`/search?q=${encodeURIComponent(term)}`} tabIndex={-1} onClick={() => setIsOpen(false)} className="block border-t p-3 text-center text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                {results.total === 1 ? "See the result" : `See all ${results.total} results`}
              </Link>
            </>
          ) : (
            <p id={listId} className="p-4 text-center text-sm text-muted-foreground">
              Nothing matches “{term}”.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
