import { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ColumnHeader } from "@workspace/tables"
import type { User } from "@workspace/db/client"
import { RoleBadges, UserStatusBadge } from "@/components/user-badges"

export const columns: ColumnDef<User, unknown>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" onClick={(e) => e.stopPropagation()} />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: () => <ColumnHeader title="Name" sortKey="name" />,
    cell: ({ row }) => row.original.name ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "email",
    header: () => <ColumnHeader title="Email" sortKey="email" />,
  },
  {
    accessorKey: "role",
    header: () => <ColumnHeader title="Role" sortKey="role" />,
    cell: ({ row }) => <RoleBadges role={row.original.role} />,
  },
  {
    id: "status",
    header: () => <ColumnHeader title="Status" />,
    cell: ({ row }) => <UserStatusBadge user={row.original} />,
  },
  {
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="Joined On" sortKey="createdAt" />,
    cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy, h:mm a")}</span>,
  },
]
