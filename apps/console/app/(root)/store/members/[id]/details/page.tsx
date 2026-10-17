import type { Metadata } from "next"
import { notFound } from "next/navigation"
import z from "zod"
import { organizationRoles } from "@workspace/auth/organization-permissions"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { formatDate } from "@workspace/utils/date"
import { getNameInitials } from "@workspace/utils/name"
import BackButton from "@/components/back-button"
import { StoreRoleBadge, UserStatusBadge } from "@/components/user-badges"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreMemberById } from "@/lib/data/members.data"
import MemberActions from "./_components/member-actions"

export const metadata: Metadata = {
  title: "Member Details",
}

type MemberDetailsPageProps = {
  params: Promise<{ id: string }>
}

export default async function MemberDetailsPage({ params }: MemberDetailsPageProps) {
  const { session, storeId, role } = await requireActiveStoreMember()

  const { id } = await params
  // Member.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getStoreMemberById(storeId, id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  const member = response.data
  const { user } = member
  const displayName = user.name ?? user.email

  // Mirrors Better Auth's removeMember: it needs member:delete, and only owners can remove an owner.
  // You leave a store from the overview page instead of removing yourself.
  const canRemove = member.userId !== session.user.id && organizationRoles[role].authorize({ member: ["delete"] }).success && (member.role !== "owner" || role === "owner")

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={user.image ?? undefined} alt="" />
            <AvatarFallback className="text-lg">{getNameInitials(displayName)}</AvatarFallback>
          </Avatar>
          <div className="grid">
            <h1 className="text-xl font-bold md:text-2xl">{displayName}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <BackButton link="/store/members" />
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Member details and account information</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="text-sm font-medium">{user.name ?? "—"}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{user.email}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Role</p>
                <div>
                  <StoreRoleBadge role={member.role} />
                </div>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <div>
                  <UserStatusBadge user={user} />
                </div>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Joined On</p>
                <p className="text-sm font-medium">{formatDate(member.createdAt, "MMM d, yyyy, h:mm a")}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-xs text-muted-foreground">Email Verified</p>
                <div>
                  <Badge variant={user.emailVerified ? "success" : "outline"}>{user.emailVerified ? "Verified" : "Unverified"}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {canRemove && <MemberActions member={{ id: member.id, organizationId: member.organizationId, name: displayName }} />}
      </div>
    </main>
  )
}
