"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { CascaderOption } from "@workspace/ui/components/cascader"
import { Search, X } from "lucide-react"
import type { FilterConfig } from "./data-table"
import DateFilter from "./filters/date-filter"
import DateRangeFilter from "./filters/date-range-filter"
import FacetedFilter, { type FacetOption } from "./filters/faceted-filter"
import NumberRangeFilter from "./filters/number-range-filter"

// Boolean filters store "true" / "false" in the URL. Pass options to relabel them, e.g. Featured / Not featured.
const DEFAULT_BOOLEAN_OPTIONS = [
  { label: "Yes", value: "true" },
  { label: "No", value: "false" },
]

// How long typing pauses before a text filter applies
const TYPING_DELAY_MS = 400

interface FiltersToolbarProps {
  filters: FilterConfig[]
}

const buildValuesFromParams = (filters: FilterConfig[], searchParams: URLSearchParams): Record<string, string> => {
  const values: Record<string, string> = {}
  filters.forEach((f) => {
    if (f.type === "dateRange") {
      values[`${f.key}Start`] = searchParams.get(`${f.key}Start`) ?? ""
      values[`${f.key}End`] = searchParams.get(`${f.key}End`) ?? ""
    } else if (f.type === "numberRange") {
      values[`${f.key}Min`] = searchParams.get(`${f.key}Min`) ?? ""
      values[`${f.key}Max`] = searchParams.get(`${f.key}Max`) ?? ""
    } else {
      values[f.key] = searchParams.get(f.key) ?? ""
    }
  })
  return values
}

// A tree filter's levels as one list, each indented under its parent and found by its whole path
const flattenTree = (options: CascaderOption[], depth = 0, path: string[] = []): FacetOption[] =>
  options.flatMap((option) => [{ label: option.label, value: option.value, depth, keywords: [...path, option.label] }, ...flattenTree(option.children ?? [], depth + 1, [...path, option.label])])

// A select's choices, without the "All …" entry that stood for no filter: the list's "Clear filter" does that now
const facetOptions = (filter: FilterConfig): FacetOption[] => {
  if (filter.type === "tree") return flattenTree(filter.tree ?? [])
  if (filter.type === "boolean") return filter.options ?? DEFAULT_BOOLEAN_OPTIONS
  return (filter.options ?? []).filter((option) => option.value !== "all")
}

// After shadcn's data table toolbar: one row of search boxes, which apply as you type, and a button per filter
const FiltersToolbar = ({ filters }: FiltersToolbarProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [values, setValues] = useState<Record<string, string>>(() => buildValuesFromParams(filters, searchParams))
  // The query this toolbar last navigated to, and the pending text filter
  const [pushedQuery, setPushedQuery] = useState<string | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(typingTimer.current ?? undefined), [])

  // Follow the URL when it changes (back and forward, a link, Reset). When the change is this toolbar's own, the search
  // boxes keep what's in them: someone may have typed on since.
  const searchParamsKey = searchParams.toString()
  const [prevSearchParamsKey, setPrevSearchParamsKey] = useState(searchParamsKey)
  if (searchParamsKey !== prevSearchParamsKey) {
    setPrevSearchParamsKey(searchParamsKey)
    const fromUrl = buildValuesFromParams(filters, searchParams)
    if (searchParamsKey === pushedQuery) {
      filters.forEach((f) => {
        if (f.type === "text" || f.type === "number") fromUrl[f.key] = values[f.key] ?? ""
      })
    }
    setValues(fromUrl)
  }

  const applyFilters = useCallback(
    (overrides: Record<string, string> = {}, { replace = false } = {}) => {
      const merged = { ...values, ...overrides }
      const params = new URLSearchParams(searchParams.toString())
      params.delete("page")

      Object.entries(merged).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })

      const query = params.toString()
      setPushedQuery(query)
      startTransition(() => {
        const href = query ? `${pathname}?${query}` : pathname
        if (replace) router.replace(href)
        else router.push(href)
      })
    },
    [values, pathname, router, searchParams]
  )

  // A choice applies at once
  const choose = (key: string, value: string) => {
    const newValues = { ...values, [key]: value }
    setValues(newValues)
    applyFilters(newValues)
  }

  // Typing applies once it pauses, replacing the history entry rather than adding one per word
  const type = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    clearTimeout(typingTimer.current ?? undefined)
    typingTimer.current = setTimeout(() => applyFilters({ [key]: value }, { replace: true }), TYPING_DELAY_MS)
  }

  const applyNow = (key: string, value: string) => {
    clearTimeout(typingTimer.current ?? undefined)
    applyFilters({ [key]: value })
  }

  const clearFilters = () => {
    clearTimeout(typingTimer.current ?? undefined)
    const cleared: Record<string, string> = {}
    filters.forEach((f) => {
      if (f.type === "dateRange") {
        cleared[`${f.key}Start`] = ""
        cleared[`${f.key}End`] = ""
      } else if (f.type === "numberRange") {
        cleared[`${f.key}Min`] = ""
        cleared[`${f.key}Max`] = ""
      } else {
        cleared[f.key] = ""
      }
    })
    setValues(cleared)
    setPushedQuery(null)
    startTransition(() => router.push(pathname))
  }

  const isFiltered = Object.values(values).some((v) => v !== "")

  return (
    <div className="flex flex-wrap items-center gap-2 p-3">
      {filters.map((filter) => {
        const id = `filter-${filter.key}`
        switch (filter.type) {
          case "text":
            return (
              <div key={filter.key} className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id={id}
                  aria-label={filter.label}
                  className="h-8 pl-8"
                  placeholder={filter.placeholder ?? filter.label}
                  value={values[filter.key] ?? ""}
                  onChange={(e) => type(filter.key, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyNow(filter.key, e.currentTarget.value)}
                />
              </div>
            )
          case "number":
            return (
              <Input
                key={filter.key}
                id={id}
                type="number"
                aria-label={filter.label}
                className="h-8 w-32"
                placeholder={filter.placeholder ?? filter.label}
                value={values[filter.key] ?? ""}
                onChange={(e) => type(filter.key, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyNow(filter.key, e.currentTarget.value)}
              />
            )
          case "select":
          case "boolean":
          case "tree":
            return (
              <FacetedFilter
                key={filter.key}
                id={id}
                title={filter.label}
                options={facetOptions(filter)}
                value={values[filter.key] ?? ""}
                onChange={(value) => choose(filter.key, value)}
                disabled={isPending}
              />
            )
          case "date":
            return (
              <div key={filter.key} className="w-full sm:w-auto">
                <DateFilter id={id} filterKey={filter.key} placeholder={filter.placeholder ?? filter.label} values={values} setValues={setValues} applyFilters={applyFilters} isPending={isPending} />
              </div>
            )
          case "dateRange":
            return (
              <div key={filter.key} className="w-full sm:w-auto">
                <DateRangeFilter
                  id={id}
                  startKey={`${filter.key}Start`}
                  endKey={`${filter.key}End`}
                  placeholder={filter.placeholder ?? filter.label}
                  values={values}
                  setValues={setValues}
                  applyFilters={applyFilters}
                  isPending={isPending}
                />
              </div>
            )
          case "numberRange":
            return (
              <NumberRangeFilter key={filter.key} minKey={`${filter.key}Min`} maxKey={`${filter.key}Max`} values={values} setValues={setValues} applyFilters={applyFilters} isPending={isPending} />
            )
        }
      })}
      {isFiltered && (
        <Button size="sm" variant="ghost" className="h-8" onClick={clearFilters} disabled={isPending}>
          Reset
          <X />
        </Button>
      )}
    </div>
  )
}

export default FiltersToolbar
