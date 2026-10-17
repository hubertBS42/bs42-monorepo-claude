import type { Metadata } from "next"
import { organizationRoles, ORG_ROLE_NAMES } from "@workspace/auth/organization-permissions"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreInvitations, INVITATION_SORT_FIELDS, MAX_INVITATIONS_PAGE_SIZE } from "@/lib/data/invitations.data"
import type { InvitationsParams } from "@/types"
import InvitationsTable from "./_components/invitations-table"
import InviteMemberDialog from "./_components/invite-member-dialog"

export const metadata: Metadata = {
  title: "Manage Invitations",
}

type StoreInvitationsPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function StoreInvitationsPage({ searchParams }: StoreInvitationsPageProps) {
  const { storeId, role } = await requireActiveStoreMember()
  const params = await searchParams

  const invitationsParams: InvitationsParams = {
    email: getStringParam(params.email),
    role: getEnumParam(params.role, ORG_ROLE_NAMES),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_INVITATIONS_PAGE_SIZE),
    sort: getSortParam(params.sort, INVITATION_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const result = await getStoreInvitations(storeId, invitationsParams)
  if (!result.success) throw new Error(result.error)

  // The invitation actions check again, through Better Auth
  const canInvite = organizationRoles[role].authorize({ invitation: ["create"] }).success
  const canCancel = organizationRoles[role].authorize({ invitation: ["cancel"] }).success

  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Manage Invitations</h1>
          <p className="text-sm text-muted-foreground">View and manage this store&apos;s pending invitations.</p>
        </div>

        {canInvite && <InviteMemberDialog storeId={storeId} />}
      </div>
      <InvitationsTable data={result.data} canResend={canInvite} canCancel={canCancel} />
    </main>
  )
}
