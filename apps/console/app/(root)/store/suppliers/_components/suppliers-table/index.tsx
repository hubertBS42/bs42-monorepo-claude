"use client"
import { Truck } from "lucide-react"
import { consoleAuthClient } from "@workspace/auth/console-client"
import { DataTable } from "@workspace/tables"
import { useMemberRole } from "@/hooks/use-member-role"
import type { SuppliersData } from "@/types"
import { columns } from "./columns"
import { supplierFilters } from "./filters"

// Rows open the supplier's edit page, for roles that can edit suppliers; the page checks again
const SuppliersTable = ({ data, storeId }: { data: SuppliersData; storeId: string }) => {
  const { role } = useMemberRole(storeId)
  const canEdit = role !== null && consoleAuthClient.organization.checkRolePermission({ role, permissions: { supplier: ["update"] } })

  return (
    <DataTable
      empty={{ icon: Truck, title: "No suppliers yet", description: "Suppliers you buy stock from show here." }}
      columns={columns}
      filters={supplierFilters}
      data={data.data}
      getRowHref={canEdit ? (supplier) => `/store/suppliers/${supplier.id}/edit` : undefined}
      pagination={{
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      }}
    />
  )
}

export default SuppliersTable
