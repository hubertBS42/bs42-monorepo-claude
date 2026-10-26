"use client"

import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTransition } from "react"

interface ColumnHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  // Leave out for columns that can't be sorted
  sortKey?: string
  enableSorting?: boolean
}

export default function ColumnHeader({ title, sortKey, enableSorting = true, className }: ColumnHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  if (!enableSorting || !sortKey) {
    return <div className={cn(className)}>{title}</div>
  }

  const currentSort = searchParams.get("sort")
  const currentOrder = searchParams.get("order")

  const isAsc = currentSort === sortKey && currentOrder === "asc"
  const isDesc = currentSort === sortKey && currentOrder === "desc"

  const handleSort = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")

    if (!isAsc && !isDesc) {
      params.set("sort", sortKey)
      params.set("order", "asc")
    } else if (isAsc) {
      params.set("sort", sortKey)
      params.set("order", "desc")
    } else {
      params.delete("sort")
      params.delete("order")
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  // The column's full width, so every sort icon sits at its column's right edge rather than after its title; -ml-2.5 and
  // the extra width line the title up with the cells below
  return (
    <Button variant="ghost" size="sm" className={cn("-ml-2.5 h-8 w-[calc(100%+0.625rem)] justify-between", className)} onClick={handleSort} disabled={isPending}>
      <span>{title}</span>
      {isDesc ? <ArrowDown /> : isAsc ? <ArrowUp /> : <ChevronsUpDown />}
    </Button>
  )
}
