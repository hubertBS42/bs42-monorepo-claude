import { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"
import { ColumnHeader } from "@workspace/tables"
import type { User } from "@workspace/db/client"
import { RoleBadges, UserStatusBadge } from "@/components/user-badges"

export const columns: ColumnDef<User, unknown>[] = [
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
    cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy")}</span>,
  },
]
