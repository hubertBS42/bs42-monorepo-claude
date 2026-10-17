import { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"
import { ColumnHeader } from "@workspace/tables"
import { UserStatusBadge } from "@/components/user-badges"
import type { StoreMember } from "@/types"
import RoleCell from "./role-cell"

interface ColumnOptions {
  viewerUserId: string
  canUpdateRoles: boolean
}

export function getColumns({ viewerUserId, canUpdateRoles }: ColumnOptions): ColumnDef<StoreMember, unknown>[] {
  return [
    {
      id: "name",
      accessorFn: (row) => row.user.name,
      header: () => <ColumnHeader title="Name" sortKey="name" />,
      cell: ({ row }) => row.original.user.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "email",
      accessorFn: (row) => row.user.email,
      header: () => <ColumnHeader title="Email" sortKey="email" />,
    },
    {
      accessorKey: "role",
      header: () => <ColumnHeader title="Role" sortKey="role" />,
      // Owners keep their role here (as in the user forms), and nobody changes their own.
      // Keyed by role so the select resets when a refresh brings a different one.
      cell: ({ row }) => <RoleCell key={row.original.role} member={row.original} canChange={canUpdateRoles && row.original.role !== "owner" && row.original.userId !== viewerUserId} />,
    },
    {
      id: "status",
      header: () => <ColumnHeader title="Status" />,
      cell: ({ row }) => <UserStatusBadge user={row.original.user} />,
    },
    {
      accessorKey: "createdAt",
      header: () => <ColumnHeader title="Joined On" sortKey="createdAt" />,
      cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy, h:mm a")}</span>,
    },
  ]
}
