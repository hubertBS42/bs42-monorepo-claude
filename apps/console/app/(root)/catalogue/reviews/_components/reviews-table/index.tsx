"use client"
import { useMemo } from "react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { hasSystemPermission } from "@workspace/auth/system-permissions"
import { DataTable } from "@workspace/tables"
import type { ReviewsData } from "@/types"
import { getColumns } from "./columns"
import { filters } from "./filters"

// No row links: a review has no page of its own, and the table shows all of it. The product cell links to the product.
const ReviewsTable = ({ data }: { data: ReviewsData }) => {
  // Once for the table rather than per row; the actions check again on the server. Null while loading.
  const { data: session, isPending } = consoleAuthClient.useSession()
  const canModerate = isPending ? null : hasSystemPermission(session?.user.role, { product: ["update"] })
  const columns = useMemo(() => getColumns({ canModerate }), [canModerate])

  return (
    <DataTable
      columns={columns}
      filters={filters}
      data={data.data}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default ReviewsTable
