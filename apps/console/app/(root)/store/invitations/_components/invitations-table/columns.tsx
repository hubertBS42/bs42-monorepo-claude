import { ColumnDef } from "@tanstack/react-table"
import { formatDate } from "@workspace/utils/date"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ColumnHeader } from "@workspace/tables"
import { StoreRoleBadge } from "@/components/user-badges"
import type { InvitationForTable } from "@/types"
import InvitationActions from "./actions"

interface ColumnOptions {
  canResend: boolean
  canCancel: boolean
}

export function getColumns({ canResend, canCancel }: ColumnOptions): ColumnDef<InvitationForTable, unknown>[] {
  return [
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
      accessorKey: "email",
      header: () => <ColumnHeader title="Email" sortKey="email" />,
    },
    {
      accessorKey: "role",
      header: () => <ColumnHeader title="Role" sortKey="role" />,
      cell: ({ row }) => <StoreRoleBadge role={row.original.role} />,
    },
    {
      id: "inviter",
      header: () => <ColumnHeader title="Invited By" sortKey="inviter" />,
      cell: ({ row }) => row.original.inviter.name ?? row.original.inviter.email,
    },
    {
      accessorKey: "createdAt",
      header: () => <ColumnHeader title="Invited On" sortKey="createdAt" />,
      cell: ({ row }) => <span>{formatDate(row.original.createdAt, "MMM d, yyyy, h:mm a")}</span>,
    },
    {
      accessorKey: "expiresAt",
      header: () => <ColumnHeader title="Expires" sortKey="expiresAt" />,
      cell: ({ row }) => {
        const isExpired = row.original.expiresAt < new Date()
        return (
          <div className="flex items-center gap-2">
            <span className={isExpired ? "text-muted-foreground" : undefined}>{formatDate(row.original.expiresAt, "MMM d, yyyy, h:mm a")}</span>
            {isExpired && <Badge variant="destructive">Expired</Badge>}
          </div>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => <InvitationActions invitation={row.original} canResend={canResend} canCancel={canCancel} />,
    },
  ]
}
