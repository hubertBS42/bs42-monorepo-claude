"use client"

import type { ReactNode } from "react"
import type { CascaderOption } from "@workspace/ui/components/cascader"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { Button } from "@workspace/ui/components/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { RowLink } from "./row-link"
import FiltersToolbar from "./filters-toolbar"
import Pagination from "./pagination"
import { useRowLink } from "./use-row-link"
import { TableEmpty, type TableEmptyConfig } from "./table-empty"

export type FilterType = "text" | "select" | "tree" | "date" | "dateRange" | "number" | "numberRange" | "boolean"

export interface FilterConfig {
  key: string
  label: string
  type: FilterType
  placeholder?: string
  options?: Array<{ label: string; value: string }>
  // For "tree": nested options (categories), any level of which can be chosen
  tree?: CascaderOption[]
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
  // Makes each row open this URL. The row's main cell becomes a real link (keyboard, new tab, copy link),
  // and a click anywhere else on the row follows it too.
  getRowHref?: (row: TData) => string
  // The column whose cell holds the link. Defaults to the first column other than "select".
  rowLinkColumnId?: string
  enablePagination?: boolean
  // Rows' ids, so a selection stays with its rows rather than their positions when the page changes
  getRowId?: (row: TData) => string
  // What can be done with the selected rows, shown in a bar above the table while any are ticked. clear() unticks
  // them, e.g. once an action has dealt with them.
  selectionActions?: (rows: TData[], clear: () => void) => ReactNode
  // What it shows with no rows (unless filters hid them)
  empty?: TableEmptyConfig
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filters = [],
  pagination,
  getRowHref,
  rowLinkColumnId,
  enablePagination = true,
  getRowId,
  selectionActions,
  empty,
}: DataTableProps<TData, TValue>) {
  const { handleRowClick, handleRowAuxClick } = useRowLink()

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
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

  // Only the rows on this page: a selection from another page isn't shown, so it isn't acted on
  const selected = table.getSelectedRowModel().rows.map((row) => row.original)

  const linkColumnId = getRowHref ? (rowLinkColumnId ?? table.getAllLeafColumns().find((column) => column.id !== "select")?.id) : undefined

  return (
    <div className="grid overflow-hidden rounded-md border">
      {filters.length > 0 && <FiltersToolbar filters={filters} />}

      {selectionActions && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">{`${selected.length} selected`}</span>
          <Button variant="ghost" size="sm" onClick={() => table.resetRowSelection()}>
            Clear
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">{selectionActions(selected, () => table.resetRowSelection())}</div>
        </div>
      )}

      <div className="relative w-full overflow-auto border border-r-0 border-l-0">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, idx) => (
                  <TableHead key={header.id} className={cn(idx === 0 && "w-7")}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const href = getRowHref?.(row.original)
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(href && "cursor-pointer")}
                    onClick={href ? (event) => handleRowClick(event, href) : undefined}
                    onAuxClick={href ? (event) => handleRowAuxClick(event, href) : undefined}
                  >
                    {row.getVisibleCells().map((cell, idx) => {
                      const content = flexRender(cell.column.columnDef.cell, cell.getContext())
                      return (
                        <TableCell key={cell.id} className={cn(idx === row.getVisibleCells().length - 1 && "w-7")}>
                          {href && cell.column.id === linkColumnId && !cell.column.columnDef.meta?.rendersRowLink ? <RowLink href={href}>{content}</RowLink> : content}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            ) : (
              <TableEmpty colSpan={columns.length} filters={filters} empty={empty} />
            )}
          </TableBody>
        </Table>
      </div>

      {enablePagination && pagination && <Pagination pagination={pagination} />}
    </div>
  )
}
