import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { ColumnHeader } from "@workspace/tables"
import type { User } from "@workspace/db/client"

const roleLabels: Record<string, string> = {
  superAdmin: "Super Admin",
  admin: "Admin",
  user: "User",
}

// Role strings can be comma-separated, so show one badge per role
const genRoleBadges = (role: string) => (
  <div className="flex flex-wrap gap-1">
    {role
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => (
        <Badge key={r} variant={r === "user" ? "outline" : "secondary"}>
          {roleLabels[r] ?? r}
        </Badge>
      ))}
  </div>
)

const genStatusBadge = (user: User) => {
  const isBanned = user.banned && (!user.banExpires || user.banExpires > new Date())
  if (isBanned) return <Badge variant="destructive">Banned</Badge>

  return (
    <Badge variant="outline" className="border-transparent bg-green-600/10 text-green-700 dark:bg-green-400/10 dark:text-green-400">
      Active
    </Badge>
  )
}

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
    cell: ({ row }) => genRoleBadges(row.original.role),
  },
  {
    id: "status",
    header: () => <ColumnHeader title="Status" sortKey="banned" enableSorting={false} />,
    cell: ({ row }) => genStatusBadge(row.original),
  },
  {
    accessorKey: "createdAt",
    header: () => <ColumnHeader title="Joined On" sortKey="createdAt" />,
    cell: ({ row }) => <span>{format(row.original.createdAt, "MMM d, yyyy, h:mm a")}</span>,
  },
]
