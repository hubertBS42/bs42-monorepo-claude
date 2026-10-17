import type { Metadata } from "next"
import { organizationRoles, ORG_ROLE_NAMES } from "@workspace/auth/organization-permissions"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreMembers, MAX_STORE_MEMBERS_PAGE_SIZE, STORE_MEMBER_SORT_FIELDS } from "@/lib/data/members.data"
import type { StoreMembersParams } from "@/types"
import MembersTable from "./_components/members-table"

export const metadata: Metadata = {
  title: "Manage Members",
}

type StoreMembersPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function StoreMembersPage({ searchParams }: StoreMembersPageProps) {
  const { session, storeId, role } = await requireActiveStoreMember()
  const params = await searchParams

  const membersParams: StoreMembersParams = {
    name: getStringParam(params.name),
    email: getStringParam(params.email),
    role: getEnumParam(params.role, ORG_ROLE_NAMES),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_STORE_MEMBERS_PAGE_SIZE),
    sort: getSortParam(params.sort, STORE_MEMBER_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const result = await getStoreMembers(storeId, membersParams)
  if (!result.success) throw new Error(result.error)

  // updateStoreMemberRoleAction checks again, through Better Auth
  const canUpdateRoles = organizationRoles[role].authorize({ member: ["update"] }).success

  return (
    <main className="flex flex-col gap-y-6">
      <div className="grid">
        <h1 className="text-xl font-bold md:text-2xl">Manage Members</h1>
        <p className="text-sm text-muted-foreground">View and manage this store&apos;s members.</p>
      </div>
      <MembersTable data={result.data} viewerUserId={session.user.id} canUpdateRoles={canUpdateRoles} />
    </main>
  )
}
