"use client"

import { flexRender, getCoreRowModel, getExpandedRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { useRowLink } from "./use-row-link"

interface DataTableTreeProps<TData extends { id: string }, TValue> {
  columns: ColumnDef<TData, TValue>[]
  // The top-level rows, each holding its children (e.g. categories with parentId null)
  data: TData[]
  // Where each row keeps its children, e.g. (category) => category.childCategories
  getSubRows: (row: TData) => TData[] | undefined
  // The column that gets the indent and expand toggle. Defaults to the first column other than "select".
  treeColumnId?: string
  // Same as DataTable: the row's tree cell becomes a link, and a click anywhere else on the row follows it too
  getRowHref?: (row: TData) => string
  defaultExpanded?: boolean
}

// Unpaginated: a page boundary would cut subtrees apart, so pass the whole tree
export function DataTableTree<TData extends { id: string }, TValue>({ columns, data, getSubRows, treeColumnId, getRowHref, defaultExpanded = true }: DataTableTreeProps<TData, TValue>) {
  const { handleRowClick, handleRowAuxClick } = useRowLink()

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    // Keyed by id so expanded rows stay expanded when the data is refreshed or reordered
    getRowId: (row) => row.id,
    getSubRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: {
      expanded: defaultExpanded ? true : {},
    },
  })

  const expanderColumnId = treeColumnId ?? table.getAllLeafColumns().find((column) => column.id !== "select")?.id
  const rows = table.getRowModel().rows

  return (
    <div className="grid overflow-hidden rounded-md border">
      <div className="relative w-full overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => {
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
                      if (cell.column.id !== expanderColumnId) {
                        return (
                          <TableCell key={cell.id} className={cn(idx === row.getVisibleCells().length - 1 && "w-7")}>
                            {content}
                          </TableCell>
                        )
                      }
                      return (
                        <TableCell key={cell.id}>
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${row.depth * 1.5}rem` }}>
                            {/* Leaves keep an empty slot of the same width so siblings line up */}
                            {row.getCanExpand() ? (
                              <button
                                type="button"
                                onClick={row.getToggleExpandedHandler()}
                                className="-m-1 flex shrink-0 cursor-pointer rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                aria-label={row.getIsExpanded() ? "Collapse row" : "Expand row"}
                                aria-expanded={row.getIsExpanded()}
                              >
                                <ChevronRight className={cn("size-4 transition-transform", row.getIsExpanded() && "rotate-90")} />
                              </button>
                            ) : (
                              <span className="size-4 shrink-0" aria-hidden />
                            )}
                            {href ? (
                              <Link href={href} className="font-medium underline-offset-4 hover:underline">
                                {content}
                              </Link>
                            ) : (
                              content
                            )}
                          </div>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                  No Results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
