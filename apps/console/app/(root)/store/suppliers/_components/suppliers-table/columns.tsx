import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { ColumnHeader } from "@workspace/tables"
import type { SupplierListItem } from "@/types"

const empty = (label: string) => (
  <span className="text-muted-foreground">
    <span aria-hidden="true">—</span>
    <span className="sr-only">{label}</span>
  </span>
)

export const columns: ColumnDef<SupplierListItem, unknown>[] = [
  {
    accessorKey: "name",
    header: () => <ColumnHeader title="Name" sortKey="name" />,
  },
  {
    accessorKey: "contactName",
    header: () => <ColumnHeader title="Contact" />,
    cell: ({ row }) => row.original.contactName ?? empty("No contact"),
  },
  {
    accessorKey: "email",
    header: () => <ColumnHeader title="Email" />,
    cell: ({ row }) => row.original.email ?? empty("No email"),
  },
  {
    accessorKey: "phone",
    header: () => <ColumnHeader title="Phone" />,
    cell: ({ row }) => row.original.phone ?? empty("No phone"),
  },
  {
    accessorKey: "purchaseOrderCount",
    header: () => <ColumnHeader title="Purchase orders" />,
  },
  {
    accessorKey: "isArchived",
    header: () => <ColumnHeader title="Status" />,
    // Archived is a normal end state, not an error, so it's muted
    cell: ({ row }) => (row.original.isArchived ? <Badge variant="secondary">Archived</Badge> : <Badge variant="success">Active</Badge>),
  },
]
