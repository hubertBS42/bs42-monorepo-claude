import { getUserById } from "@/lib/data/users.data"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import EditStoreUserForm from "./_components/edit-store-user-form"
import EditAdminForm from "./_components/edit-admin-form"
import { getStoresForSelect } from "@/lib/data/stores.data"
import { requireSystemPermission } from "@/lib/auth-guard"
import { consoleAdminRoles, hasSystemRole } from "@workspace/auth/system-permissions"
import z from "zod"

export const metadata: Metadata = {
  title: "Edit User",
}

interface EditUserPageProps {
  params: Promise<{ id: string }>
}

const EditUserPage = async ({ params }: EditUserPageProps) => {
  await requireSystemPermission({ user: ["update"] })

  const { id } = await params
  // User.id is a uuid column, so anything else would make Prisma throw instead of returning nothing
  if (!z.uuid().safeParse(id).success) notFound()

  const response = await getUserById(id)
  if (!response.success) {
    if (response.code === "NOT_FOUND") notFound()
    throw new Error(response.error)
  }

  const user = response.data

  if (hasSystemRole(user.role, consoleAdminRoles)) return <EditAdminForm user={user} />

  const storesResponse = await getStoresForSelect()
  if (!storesResponse.success) throw new Error(storesResponse.error)

  return <EditStoreUserForm user={user} stores={storesResponse.data} />
}
export default EditUserPage
