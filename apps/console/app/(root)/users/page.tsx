import type { Metadata } from "next"
import UsersTable from "./_components/users-table"
import { getUsers, MAX_USERS_PAGE_SIZE, USER_SORT_FIELDS } from "@/lib/data/users.data"
import type { UsersParams } from "@/types"
import { getOrderParam, getPositiveIntegerParam, getSortParam, getStringParam } from "@workspace/utils/search-params"
import { requireSystemPermission } from "@/lib/auth-guard"
import AddButton from "@/components/add-button"

export const metadata: Metadata = {
  title: "Manage Users",
}

type UsersPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requireSystemPermission({ user: ["list"] })
  const params = await searchParams

  const usersParams: UsersParams = {
    name: getStringParam(params.name),
    email: getStringParam(params.email),
    page: getPositiveIntegerParam(params.page, 1),
    pageSize: getPositiveIntegerParam(params.pageSize, 10, MAX_USERS_PAGE_SIZE),
    sort: getSortParam(params.sort, USER_SORT_FIELDS),
    order: getOrderParam(params.order),
  }

  const result = await getUsers(usersParams)
  if (!result.success) throw new Error(result.error)
  return (
    <main className="flex flex-col gap-y-6">
      <div className="flex items-end justify-between">
        <div className="grid">
          <h1 className="text-xl font-bold md:text-2xl">Manage Users</h1>
          <p className="text-sm text-muted-foreground">View and manage all users.</p>
        </div>
     
        <AddButton label="Add User" url="/users/add" />
      </div>
      <UsersTable data={result.data} />
    </main>
  )
}
