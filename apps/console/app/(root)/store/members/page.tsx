import type { Metadata } from "next"
import { ORG_ROLE_NAMES } from "@workspace/auth/organization-permissions"
import { getEnumParam, getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import { requireActiveStoreMember } from "@/lib/auth-guard"
import { getStoreMembers, MAX_STORE_MEMBERS_PAGE_SIZE, STORE_MEMBER_SORT_FIELDS } from "@/lib/data/members.data"
import type { StoreMembersParams } from "@/types"
import InviteMemberDialog from "../_components/invite-member-dialog"
import MembersTable from "./_components/members-table"

export const metadata: Metadata = {
  title: "Members",
}

type StoreMembersPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function StoreMembersPage({ searchParams }: StoreMembersPageProps) {
  const { storeId } = await requireActiveStoreMember()
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

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Members</h1>
          {/* Otherwise a store whose only members are platform staff looks empty by mistake */}
          <p className="text-sm text-muted-foreground">View and manage this store&apos;s members. Platform staff aren&apos;t listed.</p>
        </div>

        <InviteMemberDialog storeId={storeId} />
      </div>
      <MembersTable storeId={storeId} data={result.data} />
    </div>
  )
}
