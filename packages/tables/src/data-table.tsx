"use client"

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import FiltersToolbar from "./filters-toolbar"
import Pagination from "./pagination"

export type FilterType =
  | "text"
  | "select"
  | "date"
  | "dateRange"
  | "number"
  | "numberRange"
  | "boolean"

export interface FilterConfig {
  key: string
  label: string
  type: FilterType
  placeholder?: string
  options?: Array<{ label: string; value: string }>
}

export interface PaginationConfig {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  filters?: FilterConfig[]
  pagination?: PaginationConfig
  onRowClick?: (row: TData) => void
  enablePagination?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filters = [],
  pagination,
  onRowClick,
  enablePagination = true,
}: DataTableProps<TData, TValue>) {
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    pageCount: pagination?.totalPages ?? 0,
    state: {
      pagination: {
        pageIndex: (pagination?.page ?? 1) - 1,
        pageSize: pagination?.pageSize ?? 20,
      },
    },
  })

  return (
    <div className="grid overflow-hidden rounded-md border">
      {filters.length > 0 && <FiltersToolbar filters={filters} />}

      <div className="relative w-full overflow-auto border border-r-0 border-l-0">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, idx) => (
                  <TableHead key={header.id} className={cn(idx === 0 && "w-7")}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell, idx) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        idx === row.getVisibleCells().length - 1 && "w-7"
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No Results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && pagination && <Pagination pagination={pagination} />}
    </div>
  )
}
