import { Badge } from "@workspace/ui/components/badge"

export const ROLE_LABELS: Record<string, string> = {
  superAdmin: "Super Admin",
  admin: "Admin",
  user: "User",
}

// Visual weight follows privilege. success/destructive are left to the status badges, so colours don't mean two things.
const ROLE_BADGE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  superAdmin: "default",
  admin: "secondary",
  user: "outline",
}

export const STORE_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
}

const STORE_ROLE_BADGE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
}

// Better Auth only clears an expired ban at the user's next sign-in, so `banned` alone can be stale
export function isBanActive(user: { banned: boolean | null; banExpires: Date | null }) {
  return Boolean(user.banned) && (!user.banExpires || user.banExpires > new Date())
}

// Role strings can be comma-separated, so show one badge per role
export function RoleBadges({ role }: { role: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {role
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
        .map((r) => (
          <Badge key={r} variant={ROLE_BADGE_VARIANTS[r] ?? "outline"}>
            {ROLE_LABELS[r] ?? r}
          </Badge>
        ))}
    </div>
  )
}

export function UserStatusBadge({ user }: { user: { banned: boolean | null; banExpires: Date | null } }) {
  if (isBanActive(user)) return <Badge variant="destructive">Banned</Badge>

  return <Badge variant="success">Active</Badge>
}

export function StoreRoleBadge({ role }: { role: string }) {
  return <Badge variant={STORE_ROLE_BADGE_VARIANTS[role] ?? "outline"}>{STORE_ROLE_LABELS[role] ?? role}</Badge>
}
