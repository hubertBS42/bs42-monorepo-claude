"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import ClientOnlySelect from "@workspace/ui/components/client-only-select"
import { PAGE_SIZE_OPTIONS } from "./constants"
import type { PaginationConfig } from "./data-table"

interface PaginationProps {
  pagination: PaginationConfig
}

const Pagination = ({ pagination }: PaginationProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const { page, pageSize, total, totalPages } = pagination

  if (total === 0) return null

  const navigate = (newPage: number, newPageSize?: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())
    if (newPageSize) params.set("pageSize", newPageSize.toString())
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="flex items-center justify-between p-4">
      <div className="hidden text-sm text-muted-foreground lg:flex lg:flex-1">
        {total.toLocaleString()} result{total !== 1 ? "s" : ""}
      </div>
      <div className="flex w-full items-center justify-between space-x-6 lg:w-fit lg:justify-normal lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="hidden text-sm lg:inline">Rows Per Page</p>
          <div className="w-17">
            <ClientOnlySelect
              value={`${pageSize}`}
              onValueChange={(value) => navigate(1, Number(value))}
              options={PAGE_SIZE_OPTIONS}
              size="sm"
              side="top"
              loadingPlaceholder="10"
              id="pageSize"
            />
          </div>
        </div>
        <div className="flex w-30 items-center justify-center text-sm">
          Page {page} of {totalPages.toLocaleString()}
        </div>
        <div className="flex items-center gap-x-2">
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => navigate(1)}
            disabled={page <= 1 || isPending}
            aria-label="Go To First Page"
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => navigate(page - 1)}
            disabled={page <= 1 || isPending}
            aria-label="Go To Previous Page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => navigate(page + 1)}
            disabled={page >= totalPages || isPending}
            aria-label="Go To Next Page"
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => navigate(totalPages)}
            disabled={page >= totalPages || isPending}
            aria-label="Go To Last Page"
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Pagination
