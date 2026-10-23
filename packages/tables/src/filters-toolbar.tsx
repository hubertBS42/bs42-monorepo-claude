"use client"

import { useCallback, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import ClientOnlySelect from "@workspace/ui/components/client-only-select"
import { Cascader } from "@workspace/ui/components/cascader"
import { X } from "lucide-react"
import type { FilterConfig } from "./data-table"
import DateFilter from "./filters/date-filter"
import DateRangeFilter from "./filters/date-range-filter"
import NumberRangeFilter from "./filters/number-range-filter"

// Boolean filters store "true" / "false" in the URL. Pass options to relabel them, e.g. Featured / Not featured.
const DEFAULT_BOOLEAN_OPTIONS = [
  { label: "Yes", value: "true" },
  { label: "No", value: "false" },
]

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

const FiltersToolbar = ({ filters }: FiltersToolbarProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [values, setValues] = useState<Record<string, string>>(() => buildValuesFromParams(filters, searchParams))

  const searchParamsKey = searchParams.toString()
  const [prevSearchParamsKey, setPrevSearchParamsKey] = useState(searchParamsKey)
  if (searchParamsKey !== prevSearchParamsKey) {
    setPrevSearchParamsKey(searchParamsKey)
    setValues(buildValuesFromParams(filters, searchParams))
  }

  const applyFilters = useCallback(
    (overrides: Record<string, string> = {}) => {
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

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [values, pathname, router, searchParams]
  )

  const clearFilters = () => {
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
    startTransition(() => router.push(pathname))
  }

  const isFiltered = Object.values(values).some((v) => v !== "")

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filters.map((filter) => (
          <div key={filter.key} className="space-y-1">
            <FieldLabel htmlFor={filter.key}>{filter.label}</FieldLabel>
            {filter.type === "text" && (
              <Input
                id={filter.key}
                className="h-8"
                placeholder={filter.placeholder ?? "Filter..."}
                value={values[filter.key] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [filter.key]: e.target.value,
                  }))
                }
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                disabled={isPending}
              />
            )}
            {filter.type === "select" && (
              <ClientOnlySelect
                id={filter.key}
                value={values[filter.key] || "all"}
                onValueChange={(value) => {
                  const newValues = {
                    ...values,
                    [filter.key]: value === "all" ? "" : value,
                  }
                  setValues(newValues)
                  applyFilters(newValues)
                }}
                options={filter.options ?? []}
                size="sm"
                loadingPlaceholder="All"
                placeholder={filter.placeholder ?? "Select..."}
                className="w-full"
              />
            )}
            {filter.type === "tree" && (
              <Cascader
                id={filter.key}
                value={values[filter.key] || null}
                onChange={(value) => {
                  const newValues = { ...values, [filter.key]: value ?? "" }
                  setValues(newValues)
                  applyFilters(newValues)
                }}
                options={filter.tree ?? []}
                leafOnly={false}
                clearable
                size="xs"
                disabled={isPending}
                placeholder={filter.placeholder ?? "All"}
              />
            )}
            {filter.type === "number" && (
              <Input
                id={filter.key}
                type="number"
                className="h-8"
                placeholder={filter.placeholder ?? "Filter..."}
                value={values[filter.key] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [filter.key]: e.target.value,
                  }))
                }
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                disabled={isPending}
              />
            )}
            {filter.type === "boolean" && (
              <ClientOnlySelect
                id={filter.key}
                value={values[filter.key] || "all"}
                onValueChange={(value) => {
                  const newValues = {
                    ...values,
                    [filter.key]: value === "all" ? "" : value,
                  }
                  setValues(newValues)
                  applyFilters(newValues)
                }}
                options={[{ label: filter.placeholder ?? "All", value: "all" }, ...(filter.options ?? DEFAULT_BOOLEAN_OPTIONS)]}
                size="sm"
                loadingPlaceholder="All"
                placeholder={filter.placeholder ?? "All"}
                className="w-full"
              />
            )}
            {filter.type === "date" && <DateFilter id={filter.key} filterKey={filter.key} values={values} setValues={setValues} applyFilters={applyFilters} isPending={isPending} />}
            {filter.type === "dateRange" && (
              <DateRangeFilter id={filter.key} startKey={`${filter.key}Start`} endKey={`${filter.key}End`} values={values} setValues={setValues} applyFilters={applyFilters} isPending={isPending} />
            )}
            {filter.type === "numberRange" && (
              <NumberRangeFilter minKey={`${filter.key}Min`} maxKey={`${filter.key}Max`} values={values} setValues={setValues} applyFilters={applyFilters} isPending={isPending} />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => applyFilters()} disabled={isPending}>
          Search
        </Button>
        {isFiltered && (
          <Button size="sm" variant="ghost" onClick={clearFilters} disabled={isPending}>
            <X className="size-4" />
            Reset Filters
          </Button>
        )}
      </div>
    </div>
  )
}

export default FiltersToolbar
